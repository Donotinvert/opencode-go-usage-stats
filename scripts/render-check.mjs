/**
 * Render check for the Client half (no browser, no npm React required).
 *
 * The client bundle only consumes `require('react')` from the Harness module
 * table, and this machine has no standalone React package to import in Node.
 * This script therefore provides a minimal synchronous React stand-in
 * (createElement + the four hooks the bundle uses), loads the real `client.js`,
 * registers the slots through a fake client context, and renders the settings
 * section, the overlay and the sidebar button to markup with a fixture payload.
 *
 * It catches render-time crashes, missing chart series, wrong stacking geometry
 * and accidental HTML tables. It does NOT prove real browser layout.
 *
 * Run from the package directory:
 *
 *   node scripts/render-check.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { aggregateUsage, utcDays } from '../index.js'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(join(here, '..', 'client.js'), 'utf8')

/* ---- minimal React stand-in ------------------------------------------- */
let hookQueue = []
let hookIndex = 0
const fakeReact = {
  createElement(type, props, ...children) {
    return { type, props: { ...(props ?? {}), ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }) } }
  },
  useState(initial) {
    const index = hookIndex
    hookIndex += 1
    if (!(index in hookQueue)) hookQueue[index] = typeof initial === 'function' ? initial() : initial
    return [hookQueue[index], (value) => { hookQueue[index] = typeof value === 'function' ? value(hookQueue[index]) : value }]
  },
  useMemo(factory) {
    return factory()
  },
  useEffect() {},
  useSyncExternalStore(_subscribe, getSnapshot) {
    return getSnapshot()
  },
}
const fakeRequire = (specifier) => {
  if (specifier !== 'react') throw new Error(`unexpected require("${specifier}")`)
  return fakeReact
}

let factory
const fakeWindow = { __ModuleLoader__: { load: ({ factory: created }) => { factory = created } } }
new Function('window', source)(fakeWindow)
if (factory === undefined) throw new Error('client.js did not register a module factory')
const client = factory(fakeRequire)

/* ---- fake client context: run each registration callback immediately ---- */
const registrations = []
const slots = {
  inject(_name, callback) { callback() },
  register(options, Component) { registrations.push({ ...options, Component }); return () => {} },
}
client.apply({
  slots,
  inject() {},
  effect() {},
})
const componentOf = (name) => {
  const found = registrations.find(registration => registration.name === name)
  if (found === undefined) throw new Error(`slot "${name}" was not registered`)
  return found.Component
}

/* ---- serialize the element tree to markup ----------------------------- */
const escapeHtml = (text) => String(text).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
function attributes(props) {
  const parts = []
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || value === undefined || value === null || typeof value === 'function') continue
    const name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key
    if (key === 'style' && typeof value === 'object') {
      const css = Object.entries(value).map(([prop, v]) => `${prop.replace(/[A-Z]/g, ch => `-${ch.toLowerCase()}`)}:${v}`).join(';')
      parts.push(`style="${escapeHtml(css)}"`)
      continue
    }
    if (value === true) parts.push(name)
    else if (value !== false) parts.push(`${name}="${escapeHtml(value)}"`)
  }
  return parts.length === 0 ? '' : ` ${parts.join(' ')}`
}
function renderNode(node) {
  if (node === undefined || node === null || node === false || node === true) return ''
  if (Array.isArray(node)) return node.map(renderNode).join('')
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(node)
  if (typeof node.type === 'function') {
    hookQueue = []
    hookIndex = 0
    return renderNode(node.type(node.props))
  }
  const { children, ...props } = node.props
  const inner = children === undefined ? '' : (Array.isArray(children) ? children.map(renderNode).join('') : renderNode(children))
  return `<${node.type}${attributes(props)}>${inner}</${node.type}>`
}
const h = fakeReact.createElement

/* ---- fixture payload (window ends today in UTC, like the Host payload) - */
const now = new Date()
const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
const days = utcDays(30, todayUtc)
const itemsByDay = new Map()
days.forEach((day, index) => {
  const records = [
    { model: 'model-a', provider: 'opencode', inputTokens: 1000 + index * 10, outputTokens: 100, reasoningTokens: 10, cacheReadTokens: 9000, cacheWriteTokens: 0 },
    { model: 'model-b', provider: 'opencode', inputTokens: 200, outputTokens: 20, cacheReadTokens: 2000, cacheWriteTokens: 0 },
    { model: 'model-c', provider: 'opencode', inputTokens: 50, outputTokens: 5, cacheReadTokens: 500, cacheWriteTokens: 0 },
  ]
  if (index % 3 === 0) records.push({ model: 'model-d', provider: 'opencode', inputTokens: 10, outputTokens: 1, cacheReadTokens: 100, cacheWriteTokens: 0 })
  itemsByDay.set(day, records)
})
const aggregated = aggregateUsage(days, itemsByDay)
const data = {
  asOf: new Date(todayUtc + 3 * 60 * 60 * 1000).toISOString(),
  dayBoundary: 'UTC',
  days: 30,
  keySource: 'render-check',
  range: { from: days[0], to: days[days.length - 1] },
  summary: aggregated.summary,
  models: aggregated.models,
  daily: aggregated.daily,
  go: { startsAt: '2026-10-19T00:00:00.000Z', totalTokens: 123456, totalRequests: 10, totalCostMicroCents: 123000000, models: [] },
  warnings: [],
  cache: { fetchedDays: 0, cachedDays: 30 },
}

const quota = {
  asOf: new Date(todayUtc + 4 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
  keySource: 'render-check',
  windows: {
    rolling: { status: 'ok', percent: 4, resetsAt: new Date(todayUtc + 6 * 60 * 60 * 1000).toISOString() },
    weekly: { status: 'ok', percent: 1, resetsAt: new Date(todayUtc + 7 * 86_400_000).toISOString() },
    monthly: { status: 'ok', percent: 21, resetsAt: new Date(todayUtc + 10 * 86_400_000).toISOString() },
  },
}

function makeController(overrides) {
  const snapshot = {
    open: false, phase: 'ready', data, error: undefined, refreshing: false, metric: 'total',
    quota, quotaError: undefined, ...overrides,
  }
  return {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    ensure: () => Promise.resolve(),
    refresh: () => Promise.resolve(),
    setMetric() {},
    toggle() {},
    close() {},
    open() {},
    prefetch() {},
  }
}
const renderSlot = (name, props = {}) => renderNode(h(componentOf(name), { controller: makeController({}), ...props }))

/* ---- assertions ------------------------------------------------------- */
const checks = []
const assert = (name, condition) => {
  checks.push([name, condition])
  if (!condition) throw new Error(`render check failed: ${name}`)
}

const settingsMarkup = renderSlot('settings.section')
assert('settings renders chart title', settingsMarkup.includes('日用量（总计）'))
assert('settings notes top3 + other', settingsMarkup.includes('Top3 模型 + 其他'))
assert('settings has stacked segments', settingsMarkup.includes('class="dsh-us-seg"'))
assert('settings has legend swatches', settingsMarkup.includes('dsh-us-swatch'))
assert('settings legend includes model-a', settingsMarkup.includes('model-a'))
assert('settings legend merges the fourth model into 其他', settingsMarkup.includes('其他'))
assert('settings renders no HTML table', !settingsMarkup.includes('<table'))
assert('settings shows the 30-day window summary', settingsMarkup.includes('最近 30 天累计'))
assert('settings shows the today summary block', settingsMarkup.includes('（UTC）') && settingsMarkup.includes('dsh-us-sum-today'))
assert('settings compares today against the window summary', settingsMarkup.includes('占 30 天'))
assert('settings marks today in the axis', settingsMarkup.includes('dsh-us-axis-today'))
assert('settings draws the average reference line', settingsMarkup.includes('class="dsh-us-avg"'))
assert('settings renders the quota row', settingsMarkup.includes('OpenCode Go 额度') && settingsMarkup.includes('5 小时') && settingsMarkup.includes('每周') && settingsMarkup.includes('每月'))
assert('settings shows quota percentages', settingsMarkup.includes('已用 21%') && settingsMarkup.includes('已用 4%'))
assert('settings shows quota reset times', settingsMarkup.includes('重置 ') && settingsMarkup.includes('每分钟刷新'))
assert('quota bar is a white-outlined transparent track', settingsMarkup.includes('border:1px solid') && settingsMarkup.includes('background:transparent'))
assert('quota fill is white and means remaining quota', settingsMarkup.includes('background:#fff') && !settingsMarkup.includes('data-tone'))
assert('quota fill width is the remaining share', settingsMarkup.includes('width:96%') && settingsMarkup.includes('width:99%') && settingsMarkup.includes('width:79%'))
assert('quota tooltip explains white = remaining', settingsMarkup.includes('白色填充为剩余额度'))
assert('fully used quota renders an empty bar', renderNode(h(componentOf('settings.section'), {
  controller: makeController({ quota: { ...quota, windows: { ...quota.windows, monthly: { status: 'rate-limited', percent: 100, resetsAt: quota.windows.monthly.resetsAt } } } }),
})).includes('width:0%'))
assert('settings dropped the data-source footnote', !settingsMarkup.includes('数据来源'))

const metricMarkup = renderNode(h(componentOf('settings.section'), { controller: makeController({ metric: 'cacheRead' }) }))
assert('metric switch relabels the chart', metricMarkup.includes('日用量（缓存读）'))

const overlayMarkup = renderNode(h(componentOf('shell.overlay'), { controller: makeController({ open: true }) }))
assert('overlay renders once open', overlayMarkup.includes('dsh-us-overlay'))
assert('overlay has a close control', overlayMarkup.includes('关闭'))
assert('overlay contains the chart', overlayMarkup.includes('dsh-us-chart'))

const footerWide = renderSlot('sidebar.footer.action', { wide: true })
const footerRail = renderSlot('sidebar.footer.action', { wide: false })
assert('wide footer shows its label', footerWide.includes('用量'))
assert('rail footer shrinks to the icon', footerRail.includes('data-wide="false"'))
assert('footer icon draws two half-ring arcs', [...footerWide.matchAll(/<path/g)].length === 4)
assert('footer top arc follows the 5-hour window', footerWide.includes('strokeDasharray="4 100"'))
assert('footer bottom arc follows the monthly window', footerWide.includes('strokeDasharray="21 100"'))

const heights = [...settingsMarkup.matchAll(/class="dsh-us-seg" style="height:([0-9.]+)%/g)].map(match => Number(match[1]))
assert('chart paints at least one segment', heights.length > 0)
assert('segment heights are finite percentages', heights.every(value => Number.isFinite(value) && value >= 0 && value <= 100))
const expectedSegments = days.reduce((sum, _day, index) => sum + 3 + (index % 3 === 0 ? 1 : 0), 0)
assert('one segment per non-zero model-day', heights.length === expectedSegments)

for (const [name] of checks) console.log(`ok - ${name}`)
console.log(`render check passed (${checks.length} assertions, ${heights.length} chart segments)`)
