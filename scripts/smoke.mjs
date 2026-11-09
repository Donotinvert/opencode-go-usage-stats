/**
 * Delivery smoke test for the Host half.
 *
 * Runs the exact Host collection path against the live OpenCode Console API
 * (using the same credential resolution the plugin uses), then asserts the
 * wire payload is internally consistent. Run from the package directory:
 *
 *   node scripts/smoke.mjs
 */
import { collect, aggregateUsage } from '../index.js'

const days = 30

// 1. The pure aggregation contract on a tiny fixture.
const fixture = new Map([
  ['2026-11-03', [
    { model: 'm-a', provider: 'opencode', inputTokens: 100, outputTokens: 20, reasoningTokens: 5, cacheReadTokens: 1000, cacheWriteTokens: 0 },
    { model: 'm-b', provider: 'opencode', inputTokens: 50, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 4 },
  ]],
  ['2026-11-04', [
    { model: 'm-a', provider: 'opencode', inputTokens: 200, outputTokens: 40, reasoningTokens: 10, cacheReadTokens: 2000, cacheWriteTokens: 0 },
  ]],
])
const aggregated = aggregateUsage(['2026-11-03', '2026-11-04'], fixture)
const checks = [
  ['fixture total tokens', aggregated.summary.total, 100 + 20 + 1000 + 50 + 10 + 4 + 200 + 40 + 2000],
  ['fixture requests', aggregated.summary.requests, 3],
  ['fixture model count', aggregated.summary.models, 2],
  ['fixture day totals sum', aggregated.daily.reduce((sum, row) => sum + row.totals.total, 0), aggregated.summary.total],
  ['fixture reasoning is subset', aggregated.summary.reasoning, 15],
]
for (const [name, actual, expected] of checks) {
  if (actual !== expected) throw new Error(`${name}: expected ${expected}, got ${actual}`)
}
console.log('fixture aggregation OK')

// 2. The live Console path.
const startedAt = Date.now()
const data = await collect(days)
const elapsedMs = Date.now() - startedAt
const sumDaily = data.daily.reduce((sum, row) => sum + row.totals.total, 0)
if (data.daily.length !== days) throw new Error(`expected ${days} daily rows, got ${data.daily.length}`)
if (sumDaily !== data.summary.total) throw new Error(`daily sum ${sumDaily} !== summary ${data.summary.total}`)
if (data.models.length === 0) throw new Error('live run returned no models')
console.log(`live collection OK in ${(elapsedMs / 1000).toFixed(1)}s`)
console.log(`  key source: ${data.keySource}`)
console.log(`  range:      ${data.range.from} .. ${data.range.to} (UTC)`)
console.log(`  total:      ${data.summary.total} tokens across ${data.summary.requests} requests / ${data.models.length} models`)
for (const model of data.models) {
  console.log(`  model:      ${model.id} (${model.providers.join(',')}) total=${model.totalTokens} input=${model.inputTokens} output=${model.outputTokens} cacheRead=${model.cacheReadTokens} requests=${model.requests}`)
}
if (data.go !== undefined) {
  console.log(`  go period:  from ${data.go.startsAt.slice(0, 10)} totalTokens=${data.go.totalTokens} requests=${data.go.totalRequests} allowanceMicroCents=${data.go.totalCostMicroCents}`)
}
if (data.warnings.length > 0) console.log(`  warnings:   ${data.warnings.join(' | ')}`)

// 3. A second read must come from the persisted day cache.
const cachedStartedAt = Date.now()
const cached = await collect(days)
const cachedElapsed = Date.now() - cachedStartedAt
if (cached.summary.total !== data.summary.total) throw new Error(`cached total ${cached.summary.total} !== live total ${data.summary.total}`)
if (cached.cache.fetchedDays > 2) throw new Error(`cached read fetched ${cached.cache.fetchedDays} days; expected at most 2`)
console.log(`cached read OK in ${(cachedElapsed / 1000).toFixed(1)}s (fetched ${cached.cache.fetchedDays} days, ${cached.cache.cachedDays} from cache)`)
