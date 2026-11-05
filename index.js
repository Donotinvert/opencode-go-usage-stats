/**
 * dsh-opencode-go-usage — Host half.
 *
 * Reads OpenCode Go usage from the official Console API (the same data the
 * Console's own charts render) and exposes it to the plugin's settings page
 * through one fenced route:
 *
 *   GET /usage-stats/api/data?days=30[&force=1]
 *
 * Why the Console API instead of local session logs: Go plan usage is metered
 * on the Console side, covers every client the key was used from, and the
 * request-log export carries the per-model token fields a model-by-day matrix
 * needs.
 *
 * Authentication: the Go API key saved by the harness credentials service
 * (`$DSH_HOME/.credentials.yaml`, refs starting with DSH_OPENCODE_GO_ACCOUNT_*,
 * or a matching environment variable). No key is ever returned to the client.
 *
 * Data shape notes:
 * - Records are bucketed by UTC calendar day (the same boundary the Console's
 *   daily chart uses); `startedAt` is epoch milliseconds.
 * - Billed tokens per record: inputTokens + outputTokens + cacheReadTokens +
 *   cacheWriteTokens. reasoningTokens is a subset of outputTokens and is only
 *   reported as a summary figure, never added on top.
 * - Records come from `/request-logs/export` (1,000-record pages). One UTC day
 *   of a personal Go plan never came close to that cap; when it does, the day
 *   is listed in `warnings` so the page can say the number may be short.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-opencode-go-usage'
export const inject = ['webServer', 'connection']

const CONSOLE_ORIGIN = 'https://opencode.ai'
const CONSOLE_API = '/console/api'
const DEFAULT_DAYS = 30
const MAX_DAYS = 30
const EXPORT_PAGE_LIMIT = 1000
const CONCURRENCY = 6
const CACHE_TTL_MS = 10 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30_000

/** One Console JSON call; non-2xx becomes an error carrying the status. */
async function consoleFetch(path, key) {
  const response = await fetch(CONSOLE_ORIGIN + CONSOLE_API + path, {
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
      'user-agent': 'dsh-opencode-go-usage/0.2.0',
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
 * Aggregate raw request-log records into the wire shape the settings page reads.
 * Pure: the Host calls it with live records, the smoke test with fixtures.
 * @param days - UTC dates, oldest first.
 * @param itemsByDay - raw Console records per date.
 * @param truncatedDays - dates whose export hit the page cap.
 */
export function aggregateUsage(days, itemsByDay, truncatedDays = new Set()) {
  const models = new Map()
  const daily = []
  const warnings = []
  const summary = {
    total: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0,
    requests: 0, models: 0,
  }

  for (const day of days) {
    const records = itemsByDay.get(day) ?? []
    const dayTotals = emptyBucket()
    const byModel = {}
    for (const record of records) {
      const model = typeof record.model === 'string' && record.model !== ''
        ? record.model
        : (typeof record.requestedModel === 'string' && record.requestedModel !== '' ? record.requestedModel : undefined)
      if (model === undefined) continue
      const bucket = models.get(model) ?? {
        id: model,
        providers: new Set(),
        tokens: emptyBucket(),
        reasoningTokens: 0,
        requests: 0,
      }
      if (typeof record.provider === 'string' && record.provider !== '') bucket.providers.add(record.provider)
      addRecord(bucket.tokens, record)
      bucket.reasoningTokens += tokenCount(record.reasoningTokens)
      bucket.requests += 1
      models.set(model, bucket)

      const dayBucket = byModel[model] ?? emptyBucket()
      addRecord(dayBucket, record)
      byModel[model] = dayBucket
      addRecord(dayTotals, record)
    }
    daily.push({ date: day, totals: dayTotals, byModel })
    summary.total += dayTotals.total
    summary.input += dayTotals.input
    summary.output += dayTotals.output
    summary.cacheRead += dayTotals.cacheRead
    summary.cacheWrite += dayTotals.cacheWrite
  }

  for (const bucket of models.values()) {
    summary.reasoning += bucket.reasoningTokens
    summary.requests += bucket.requests
  }

  for (const day of truncatedDays) warnings.push(`${day} 的请求数达到导出分页上限（${EXPORT_PAGE_LIMIT} 条），该日统计可能偏小。`)

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

/** Fetch one UTC day of request records through the export endpoint. */
async function fetchDayRecords(day, key) {
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
      return { items, truncated }
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
 * Collect the full payload the settings page renders.
 * Exported so the delivery smoke test can run the exact Host path in Node.
 * @param days - window size in days (already clamped).
 */
export async function collect(days) {
  const { key, source } = resolveApiKey()
  const list = utcDays(days)
  const itemsByDay = new Map()
  const truncatedDays = new Set()
  const failures = []

  const results = await mapLimit(list, CONCURRENCY, async (day) => {
    try {
      return await fetchDayRecords(day, key)
    } catch (error) {
      failures.push(`${day}: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  })
  results.forEach((result, index) => {
    if (result === undefined) return
    itemsByDay.set(list[index], result.items)
    if (result.truncated) truncatedDays.add(list[index])
  })

  if (failures.length === list.length) {
    const error = new Error(`拉取 OpenCode Console 数据失败（${failures[0]}）`)
    error.code = 'upstream-unreachable'
    throw error
  }

  const aggregated = aggregateUsage(list, itemsByDay, truncatedDays)
  const warnings = [...aggregated.warnings]
  if (failures.length > 0) warnings.push(`有 ${failures.length} 天的数据拉取失败，已跳过：${failures.slice(0, 3).join('；')}`)

  let go
  try {
    go = aggregateGoSeries(await consoleFetch('/activity/go', key))
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
    summary: aggregated.summary,
    models: aggregated.models,
    daily: aggregated.daily,
    go,
    warnings,
  }
}

/** Serialize one JSON response with no client-side caching. */
function writeJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/**
 * Host plugin body: register the one fenced JSON route and keep a small
 * in-memory cache so reopening the settings page does not re-pull 30 days.
 * @param ctx - host context (webServer, connection).
 */
export function apply(ctx) {
  let cache
  let inflight

  const load = async (days, force) => {
    if (!force && cache !== undefined && cache.days === days && Date.now() - cache.at < CACHE_TTL_MS) return cache.data
    if (inflight !== undefined && inflight.days === days) return inflight.promise
    const promise = collect(days)
      .then((data) => {
        cache = { days, at: Date.now(), data }
        return data
      })
      .finally(() => {
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
      const force = url.searchParams.get('force') === '1'
      try {
        writeJson(res, 200, { ok: true, data: await load(days, force) })
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
}
