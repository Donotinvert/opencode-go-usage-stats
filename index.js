/**
 * dsh-opencode-go-usage — Host half.
 *
 * Reads OpenCode Go usage from the official Console API (the same data the
 * Console's own charts render) and exposes it to the plugin's UI through one
 * fenced route:
 *
 *   GET /usage-stats/api/data?days=30[&force=1|&full=1]
 *
 * Loading model (the user-facing problem this solves): a cold 30-day read is
 * 30 request-log exports (10–30 seconds). Once a UTC day is over its records are
 * immutable, so the Host caches each day's aggregate on disk and only refetches
 * today (and yesterday, briefly) afterwards. The cache is warmed at startup and
 * refreshed every 10 minutes in the background, so opening the panel normally
 * hits memory/disk and returns in well under a second.
 *
 *   default   fetch only missing/stale days
 *   force=1   refresh today (+ yesterday) and keep older days cached
 *   full=1    refetch the whole window (debugging)
 *
 * Auth: the Go API key saved by the harness credentials service
 * (`$DSH_HOME/.credentials.yaml`, refs starting with DSH_OPENCODE_GO_ACCOUNT_*,
 * or a matching environment variable). No key is ever returned to the client.
 *
 * Data shape notes:
 * - Records are bucketed by UTC calendar day (the Console's own daily boundary).
 * - Billed tokens per record: inputTokens + outputTokens + cacheReadTokens +
 *   cacheWriteTokens. reasoningTokens is a subset of outputTokens.
 * - Records come from `/request-logs/export` (1,000-record pages); a day that
 *   hits the cap is flagged in `warnings`.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-opencode-go-usage'
export const inject = ['webServer', 'connection']

const CONSOLE_ORIGIN = 'https://opencode.ai'
const CONSOLE_API = '/console/api'
const DEFAULT_DAYS = 30
const MAX_DAYS = 30
const EXPORT_PAGE_LIMIT = 1000
const LIST_PAGE_LIMIT = 100
const LIST_MAX_PAGES = 50
const CONCURRENCY = 6
const REQUEST_TIMEOUT_MS = 30_000
const CACHE_VERSION = 1
const CACHE_FILE = 'day-aggregates.v1.json'
const TODAY_TTL_MS = 10 * 60 * 1000
const YESTERDAY_TTL_MS = 2 * 60 * 60 * 1000
const GO_TTL_MS = 60 * 1000
const WARM_INTERVAL_MS = 10 * 60 * 1000

/** One Console JSON call; non-2xx becomes an error carrying the status. */
async function consoleFetch(path, key) {
  const response = await fetch(CONSOLE_ORIGIN + CONSOLE_API + path, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
      'user-agent': 'dsh-opencode-go-usage/0.3.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.text()).slice(0, 300)
    } catch {
      /* the body is optional diagnostic text */
    }
    const error = new Error(`Console API ${response.status} ${path}${detail === '' ? '' : `: ${detail}`}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

/** `$DSH_HOME`, falling back to `~/.dsh` when the variable is absent. */
function harnessHome() {
  const configured = process.env.DSH_HOME
  return configured === undefined || configured === '' ? join(homedir(), '.dsh') : configured
}

/** Directory holding this plugin's persisted day cache. */
function cacheDirectory() {
  return join(harnessHome(), 'cache', 'dsh-opencode-go-usage')
}

/** The saved Go API key from the environment, if one was exported. */
function keyFromEnvironment() {
  for (const [variable, value] of Object.entries(process.env)) {
    if (!/^DSH_OPENCODE_GO_ACCOUNT_[0-9A-F]+$/i.test(variable)) continue
    if (typeof value === 'string' && value.startsWith('oc_')) return { key: value, source: `env:${variable}` }
  }
  const direct = process.env.DSH_OPENCODE_GO_API_KEY ?? process.env.OPENCODE_GO_API_KEY
  if (typeof direct === 'string' && direct.startsWith('oc_')) return { key: direct, source: 'env:DSH_OPENCODE_GO_API_KEY' }
  return undefined
}

/**
 * The saved Go API key from the harness credential store. That document is a
 * small YAML map and only its refs are needed, so it is read with a tolerant
 * regex instead of pulling a YAML parser into the bundle.
 */
function keyFromCredentials() {
  let document
  try {
    document = readFileSync(join(harnessHome(), '.credentials.yaml'), 'utf8')
  } catch {
    return undefined
  }
  const named = document.match(
    /^[ \t-]*([A-Za-z0-9_./:@-]*OPENCODE[A-Za-z0-9_./:@-]*)_ACCOUNT_[A-Za-z0-9_./:@-]*[ \t]*:[ \t]*["']?(oc_[A-Za-z0-9_-]+)/im,
  )
  if (named !== null) return { key: named[2], source: 'credentials:opencode-go' }
  const any = document.match(/oc_sk_[A-Za-z0-9_-]+/)
  return any === null ? undefined : { key: any[0], source: 'credentials:first-oc-key' }
}

/** Resolve the key once per collection; a missing key is an explicit failure. */
function resolveApiKey() {
  const resolved = keyFromEnvironment() ?? keyFromCredentials()
  if (resolved === undefined) {
    const error = new Error(
      '未找到 OpenCode Go API Key：请确认已通过 /connect 或 Models 页面配置 OpenCode Go（凭据保存在 $DSH_HOME/.credentials.yaml）。',
    )
    error.code = 'missing-api-key'
    throw error
  }
  return resolved
}

/** UTC calendar day of an epoch-millisecond timestamp (`YYYY-MM-DD`). */
export function utcDay(epochMs) {
  return new Date(epochMs).toISOString().slice(0, 10)
}

/** Inclusive list of the last `days` UTC days, oldest first. */
export function utcDays(days, now = Date.now()) {
  const current = new Date(now)
  const end = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate())
  const list = []
  for (let offset = days - 1; offset >= 0; offset -= 1) list.push(utcDay(end - offset * 86_400_000))
  return list
}

/** Non-negative finite number or 0. */
export function tokenCount(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** A day/model bucket with the four disjoint token fields plus a billed total. */
function emptyBucket() {
  return { total: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

/** Add one request record's tokens into a bucket. */
function addRecord(bucket, record) {
  const input = tokenCount(record.inputTokens)
  const output = tokenCount(record.outputTokens)
  const cacheRead = tokenCount(record.cacheReadTokens)
  const cacheWrite = tokenCount(record.cacheWriteTokens)
  bucket.input += input
  bucket.output += output
  bucket.cacheRead += cacheRead
  bucket.cacheWrite += cacheWrite
  bucket.total += input + output + cacheRead + cacheWrite
}

/**
 * Fold one UTC day of request-log records into its cached aggregate.
 * Pure, so the cache file and the smoke test share the exact same fold.
 * @param day - UTC date (`YYYY-MM-DD`).
 * @param records - raw Console request-log records for that day.
 * @param truncated - whether the export hit its page cap.
 */
export function aggregateDay(day, records, truncated = false) {
  const totals = emptyBucket()
  const byModel = {}
  let reasoning = 0
  let requests = 0
  for (const record of records) {
    const model = typeof record.model === 'string' && record.model !== ''
      ? record.model
      : (typeof record.requestedModel === 'string' && record.requestedModel !== '' ? record.requestedModel : undefined)
    if (model === undefined) continue
    const bucket = byModel[model] ?? { tokens: emptyBucket(), reasoningTokens: 0, requests: 0, providers: [] }
    addRecord(bucket.tokens, record)
    bucket.reasoningTokens += tokenCount(record.reasoningTokens)
    bucket.requests += 1
    if (typeof record.provider === 'string' && record.provider !== '' && !bucket.providers.includes(record.provider)) {
      bucket.providers.push(record.provider)
    }
    byModel[model] = bucket
    addRecord(totals, record)
    reasoning += tokenCount(record.reasoningTokens)
    requests += 1
  }
  return { date: day, totals, byModel, reasoningTokens: reasoning, requests, truncated, fetchedAt: Date.now() }
}

/**
 * Merge per-day aggregates into the wire payload the UI renders.
 * @param dayAggregates - one aggregate per date, oldest first.
 */
export function mergeDayAggregates(dayAggregates) {
  const models = new Map()
  const daily = []
  const warnings = []
  const summary = {
    total: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0,
    requests: 0, models: 0,
  }
  for (const day of dayAggregates) {
    const byModel = {}
    for (const [model, bucket] of Object.entries(day.byModel)) {
      const existing = models.get(model) ?? {
        id: model,
        providers: new Set(),
        tokens: emptyBucket(),
        reasoningTokens: 0,
        requests: 0,
      }
      for (const provider of bucket.providers) existing.providers.add(provider)
      addBucket(existing.tokens, bucket.tokens)
      existing.reasoningTokens += bucket.reasoningTokens
      existing.requests += bucket.requests
      models.set(model, existing)
      byModel[model] = bucket.tokens
    }
    daily.push({ date: day.date, totals: day.totals, byModel })
    summary.total += day.totals.total
    summary.input += day.totals.input
    summary.output += day.totals.output
    summary.cacheRead += day.totals.cacheRead
    summary.cacheWrite += day.totals.cacheWrite
    summary.requests += day.requests
    summary.reasoning += day.reasoningTokens
    if (day.truncated === true) warnings.push(`${day.date} 的请求数达到导出分页上限（${EXPORT_PAGE_LIMIT} 条），该日统计可能偏小。`)
  }

  const modelList = [...models.values()]
    .filter(bucket => bucket.tokens.total > 0)
    .map(bucket => ({
      id: bucket.id,
      providers: [...bucket.providers].sort(),
      totalTokens: bucket.tokens.total,
      inputTokens: bucket.tokens.input,
      outputTokens: bucket.tokens.output,
      reasoningTokens: bucket.reasoningTokens,
      cacheReadTokens: bucket.tokens.cacheRead,
      cacheWriteTokens: bucket.tokens.cacheWrite,
      requests: bucket.requests,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)

  summary.models = modelList.length
  return { summary, models: modelList, daily, warnings }
}

/** Add one token bucket into another (both keep the same five fields). */
function addBucket(target, source) {
  target.total += source.total
  target.input += source.input
  target.output += source.output
  target.cacheRead += source.cacheRead
  target.cacheWrite += source.cacheWrite
}

/**
 * Aggregate raw request-log records into the wire shape (kept for the smoke
 * test's fixture assertions).
 * @param days - UTC dates, oldest first.
 * @param itemsByDay - raw Console records per date.
 * @param truncatedDays - dates whose export hit the page cap.
 */
export function aggregateUsage(days, itemsByDay, truncatedDays = new Set()) {
  return mergeDayAggregates(days.map(day => aggregateDay(day, itemsByDay.get(day) ?? [], truncatedDays.has(day))))
}

/** Fold the official Go-period chart (`/activity/go`) into summary figures. */
export function aggregateGoSeries(go) {
  const rows = Array.isArray(go?.daily) ? go.daily : []
  let totalTokens = 0
  let totalRequests = 0
  let totalCostMicroCents = 0
  for (const row of rows) {
    totalTokens += tokenCount(row.totalTokens)
    totalRequests += tokenCount(row.totalRequests)
    totalCostMicroCents += tokenCount(row.totalCostMicroCents)
  }
  return {
    startsAt: typeof go?.startsAt === 'string' ? go.startsAt : undefined,
    totalTokens,
    totalRequests,
    totalCostMicroCents,
    models: Array.isArray(go?.models)
      ? go.models
        .filter(entry => typeof entry?.model === 'string')
        .map(entry => ({
          model: entry.model,
          provider: typeof entry.provider === 'string' ? entry.provider : undefined,
          requests: tokenCount(entry.totalRequests),
        }))
      : [],
  }
}

/** Load the persisted day cache; a missing or unreadable file reads as empty. */
function readDayCache() {
  try {
    const parsed = JSON.parse(readFileSync(join(cacheDirectory(), CACHE_FILE), 'utf8'))
    if (parsed?.version !== CACHE_VERSION || typeof parsed.days !== 'object' || parsed.days === null) return { version: CACHE_VERSION, days: {} }
    return parsed
  } catch {
    return { version: CACHE_VERSION, days: {} }
  }
}

/** Persist the day cache atomically; failures only lose the optimization. */
function writeDayCache(cache) {
  try {
    mkdirSync(cacheDirectory(), { recursive: true })
    const file = join(cacheDirectory(), CACHE_FILE)
    const temp = `${file}.tmp`
    writeFileSync(temp, JSON.stringify(cache), 'utf8')
    renameSync(temp, file)
  } catch {
    /* best-effort cache: never break a request over it */
  }
}

/** Drop cached days older than the retention window to keep the file small. */
function pruneDayCache(cache, now = Date.now()) {
  const oldest = utcDay(now - (MAX_DAYS + 10) * 86_400_000)
  for (const day of Object.keys(cache.days)) {
    if (day < oldest) delete cache.days[day]
  }
}

/** Whether one cached day aggregate can be reused as-is. */
function dayIsFresh(aggregate, now = Date.now()) {
  if (aggregate === undefined || aggregate === null || typeof aggregate.fetchedAt !== 'number') return false
  const today = utcDay(now)
  /* A capped day costs many list pages, so keep it cached longer. */
  const todayTtl = aggregate.truncated === true ? TODAY_TTL_MS * 3 : TODAY_TTL_MS
  const yesterdayTtl = aggregate.truncated === true ? YESTERDAY_TTL_MS * 3 : YESTERDAY_TTL_MS
  if (aggregate.date === today) return now - aggregate.fetchedAt < todayTtl
  const yesterday = utcDay(now - 86_400_000)
  if (aggregate.date === yesterday) return now - aggregate.fetchedAt < yesterdayTtl
  return true
}

/**
 * Re-read one day through the cursor-paged list endpoint. Used only when the
 * export endpoint reports a capped day (>1,000 records): the export carries no
 * continuation cursor, and the list cursor is a raw JSON string, not an object.
 * @param day - UTC date (`YYYY-MM-DD`).
 */
async function fetchDayRecordsViaList(day, key) {
  const start = Date.parse(`${day}T00:00:00.000Z`)
  const until = String(start + 86_400_000 - 1)
  const items = []
  let cursor
  for (let page = 0; page < LIST_MAX_PAGES; page += 1) {
    const query = new URLSearchParams({ since: String(start), until, limit: String(LIST_PAGE_LIMIT) })
    if (cursor !== undefined) query.set('cursor', cursor)
    const payload = await consoleFetch(`/request-logs?${query.toString()}`, key)
    const pageItems = Array.isArray(payload?.items) ? payload.items : []
    items.push(...pageItems)
    cursor = typeof payload?.nextCursor === 'string' ? payload.nextCursor : undefined
    if (cursor === undefined || pageItems.length === 0) return { items, truncated: false }
  }
  return { items, truncated: true }
}

/** Fetch one UTC day of request records and fold it into an aggregate. */
async function fetchDayAggregate(day, key) {
  const start = Date.parse(`${day}T00:00:00.000Z`)
  const query = new URLSearchParams({
    format: 'json',
    since: String(start),
    until: String(start + 86_400_000 - 1),
  })
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const exportPayload = await consoleFetch(`/request-logs/export?${query.toString()}`, key)
      const content = typeof exportPayload?.content === 'string' ? JSON.parse(exportPayload.content) : exportPayload?.content
      const items = Array.isArray(content?.items) ? content.items : []
      const truncated = exportPayload?.truncated === true || content?.truncated === true || items.length >= EXPORT_PAGE_LIMIT
      if (!truncated) return aggregateDay(day, items, false)
      /* Capped export: continue through the list cursor so a busy day is exact. */
      try {
        const full = await fetchDayRecordsViaList(day, key)
        return aggregateDay(day, full.items, full.truncated)
      } catch {
        return aggregateDay(day, items, true)
      }
    } catch (error) {
      lastError = error
      /* A transient TLS/proxy reset on one day must not sink the whole page. */
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)))
    }
  }
  throw lastError
}

/** Bounded-concurrency map over the day list. */
async function mapLimit(values, limit, run) {
  const results = new Array(values.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= values.length) return
      results[index] = await run(values[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Collect the full payload the UI renders, reusing the persisted day cache.
 * Exported so the delivery smoke test can run the exact Host path in Node.
 * @param days - window size in days (already clamped).
 * @param options - `force` refreshes today/yesterday; `full` refetches all.
 */
export async function collect(days, options = {}) {
  const { key, source } = resolveApiKey()
  const list = utcDays(days)
  const cache = readDayCache()
  const now = Date.now()
  const force = options.force === true
  const full = options.full === true
  const today = utcDay(now)
  const yesterday = utcDay(now - 86_400_000)

  const wanted = []
  for (const day of list) {
    const cached = cache.days[day]
    if (full) {
      wanted.push(day)
      continue
    }
    if (force && (day === today || day === yesterday)) {
      wanted.push(day)
      continue
    }
    if (dayIsFresh(cached, now)) continue
    wanted.push(day)
  }

  const failures = []
  const fetched = new Map()
  const results = await mapLimit(wanted, CONCURRENCY, async (day) => {
    try {
      return await fetchDayAggregate(day, key)
    } catch (error) {
      failures.push(`${day}: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  })
  results.forEach((aggregate) => {
    if (aggregate === undefined) return
    fetched.set(aggregate.date, aggregate)
    cache.days[aggregate.date] = aggregate
  })

  if (wanted.length > 0) {
    pruneDayCache(cache, now)
    writeDayCache(cache)
  }

  const aggregates = list.map((day) => {
    const fetchedDay = fetched.get(day)
    if (fetchedDay !== undefined) return fetchedDay
    const cached = cache.days[day]
    if (cached !== undefined) return cached
    return aggregateDay(day, [], false)
  })

  if (failures.length === list.length) {
    const error = new Error(`拉取 OpenCode Console 数据失败（${failures[0]}）`)
    error.code = 'upstream-unreachable'
    throw error
  }

  const merged = mergeDayAggregates(aggregates)
  const warnings = [...merged.warnings]
  if (failures.length > 0) warnings.push(`有 ${failures.length} 天的数据拉取失败，已跳过：${failures.slice(0, 3).join('；')}`)
  const staleDays = list.filter(day => cache.days[day] !== undefined && !dayIsFresh(cache.days[day], now))
  if (staleDays.length > 0) warnings.push(`${staleDays.length} 天使用磁盘缓存（${staleDays[0]}${staleDays.length > 1 ? ' 等' : ''}）。`)

  let go
  try {
    go = aggregateGoSeries(await consoleFetchCached('/activity/go', key))
  } catch (error) {
    warnings.push(`官方 Go 周期汇总拉取失败：${error instanceof Error ? error.message : String(error)}`)
    go = undefined
  }

  return {
    asOf: new Date().toISOString(),
    dayBoundary: 'UTC',
    days,
    keySource: source,
    range: { from: list[0], to: list[list.length - 1] },
    summary: merged.summary,
    models: merged.models,
    daily: merged.daily,
    go,
    warnings,
    cache: { fetchedDays: fetched.size, cachedDays: list.length - fetched.size },
  }
}

/** Short-TTL cache for the small `/activity/go` payload. */
let goCache = { at: 0, data: undefined }
async function consoleFetchCached(path, key) {
  if (goCache.data !== undefined && Date.now() - goCache.at < GO_TTL_MS) return goCache.data
  const data = await consoleFetch(path, key)
  goCache = { at: Date.now(), data }
  return data
}

/** Serialize one JSON response with no client-side caching. */
function writeJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Host plugin body: register the fenced JSON route, the background warm-up, and
 * the in-process cache that makes later reads cheap.
 * @param ctx - host context (webServer, connection).
 */
export function apply(ctx) {
  let inflight

  const load = async (days, options = {}) => {
    if (inflight !== undefined && inflight.days === days && options.force !== true && options.full !== true) return inflight.promise
    const promise = collect(days, options).finally(() => {
      if (inflight !== undefined && inflight.promise === promise) inflight = undefined
    })
    inflight = { days, promise }
    return promise
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/usage-stats/api',
    handler: async (req, res) => {
      if (ctx.connection.requestRejection(req) !== undefined) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      if (url.pathname !== '/usage-stats/api/data') {
        writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'not found' } })
        return
      }
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      const requested = Number(url.searchParams.get('days') ?? DEFAULT_DAYS)
      const days = Number.isFinite(requested) ? Math.min(MAX_DAYS, Math.max(1, Math.round(requested))) : DEFAULT_DAYS
      const options = {
        force: url.searchParams.get('force') === '1',
        full: url.searchParams.get('full') === '1',
      }
      try {
        writeJson(res, 200, { ok: true, data: await load(days, options) })
      } catch (error) {
        writeJson(res, 502, {
          ok: false,
          error: {
            code: typeof error?.code === 'string' ? error.code : 'upstream-failed',
            message: error instanceof Error ? error.message : String(error),
          },
        })
      }
    },
  }), 'dsh-opencode-go-usage: /usage-stats/api routes')

  /* Warm the cache after activation so the first panel open is usually instant,
     then keep today's bucket fresh without anyone opening the UI. */
  ctx.effect(() => {
    const warm = () => {
      load(DEFAULT_DAYS).catch(() => {
        /* warm-up failures stay silent; the UI reports them on demand */
      })
    }
    const timer = setTimeout(warm, 1500)
    const interval = setInterval(warm, WARM_INTERVAL_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, 'dsh-opencode-go-usage: background warm-up')
}
