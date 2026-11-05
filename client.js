window.__ModuleLoader__.load({
  id: 'dsh-usage-stats',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const METRICS = [
      { id: 'total', label: '总计' },
      { id: 'input', label: '输入' },
      { id: 'output', label: '输出' },
      { id: 'cacheRead', label: '缓存读' },
    ]

    const CSS = `
.dsh-us{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.5}
.dsh-us *{box-sizing:border-box}
.dsh-us-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dsh-us-title{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em}
.dsh-us-sub{margin:4px 0 0;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d8dee4);background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;font-size:12px;border-radius:8px;padding:5px 12px;cursor:pointer;white-space:nowrap}
.dsh-us-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.dsh-us-btn:disabled{opacity:.55;cursor:default}
.dsh-us-btn[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:var(--dsw-alias-brand-primary,#4d6bfe);background:transparent}
.dsh-us-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.dsh-us-card{border:.5px solid var(--dsw-alias-settings-card-stroke,#d8dee4);background:var(--dsw-alias-settings-card-fill,#fff);border-radius:12px;padding:12px 14px}
.dsh-us-card-label{color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-card-value{margin-top:4px;font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.dsh-us-card-hint{margin-top:2px;color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px}
.dsh-us-meta{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-meta strong{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}
.dsh-us-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dsh-us-controls-label{color:var(--dsw-alias-label-secondary,#59636e);font-size:12px;margin-right:2px}
.dsh-us-group{border:.5px solid var(--dsw-alias-settings-card-stroke,#d8dee4);background:var(--dsw-alias-settings-card-fill,#fff);border-radius:12px;overflow:hidden}
.dsh-us-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:.5px solid var(--dsw-alias-border-l2,#d8dee4)}
.dsh-us-group-title{margin:0;font-size:13px;font-weight:600}
.dsh-us-group-note{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px}
.dsh-us-scroll{overflow:auto;max-height:420px}
.dsh-us-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.dsh-us-table th,.dsh-us-table td{padding:7px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2,#d8dee4);white-space:nowrap}
.dsh-us-table th{color:var(--dsw-alias-label-secondary,#59636e);font-weight:530;font-size:12px;text-align:right;position:sticky;top:0;background:var(--dsw-alias-bg-layer-1,#fff);z-index:1}
.dsh-us-table th:first-child,.dsh-us-table td:first-child{text-align:left}
.dsh-us-table td{text-align:right}
.dsh-us-table tbody tr:last-child td{border-bottom:none}
.dsh-us-table tbody tr:hover td{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.dsh-us-table tr.dsh-us-total td{font-weight:600;background:var(--dsw-alias-bg-l1,#f6f8fa)}
.dsh-us-model{display:flex;flex-direction:column;gap:1px}
.dsh-us-model-name{font-weight:530}
.dsh-us-model-provider{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px}
.dsh-us-bar{display:inline-block;width:64px;height:6px;border-radius:3px;background:var(--dsw-alias-bg-l2,#f6f8fa);overflow:hidden;vertical-align:middle;margin-right:8px}
.dsh-us-bar>span{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsh-us-date{color:var(--dsw-alias-label-secondary,#59636e)}
.dsh-us-today{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:600}
.dsh-us-zero{color:var(--dsw-alias-label-tertiary,#818b98)}
.dsh-us-empty{padding:24px 14px;text-align:center;color:var(--dsw-alias-label-secondary,#59636e)}
.dsh-us-error{border:1px solid var(--dsw-alias-state-error-primary,#cf222e);color:var(--dsw-alias-state-error-primary,#cf222e);border-radius:10px;padding:12px 14px;font-size:12px;word-break:break-word}
.dsh-us-warn{color:var(--dsw-alias-state-warn-label,#9a6700);font-size:12px}
.dsh-us-note{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px;line-height:1.6}
.dsh-us-loading{display:flex;flex-direction:column;gap:6px;padding:18px 14px;color:var(--dsw-alias-label-secondary,#59636e)}
`

    let numberFormat
    try {
      numberFormat = new Intl.NumberFormat('zh-CN')
    } catch {
      numberFormat = { format: value => String(value) }
    }

    function compactTokens(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      if (number >= 1e9) return `${(number / 1e9).toFixed(2)}B`
      if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 1 : 2)}M`
      if (number >= 1e3) return `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1)}K`
      return String(Math.round(number))
    }

    function fullNumber(value) {
      const number = Number(value)
      return numberFormat.format(Number.isFinite(number) ? Math.round(number) : 0)
    }

    function formatMoney(microCents) {
      return `$${((Number(microCents) || 0) / 1e8).toFixed(2)}`
    }

    function metricOf(bucket, metric) {
      if (bucket === undefined || bucket === null) return 0
      const field = metric === 'input' ? 'input' : metric === 'output' ? 'output' : metric === 'cacheRead' ? 'cacheRead' : 'total'
      return Number(bucket[field]) || 0
    }

    function Card(props) {
      return h('div', { className: 'dsh-us-card' },
        h('div', { className: 'dsh-us-card-label' }, props.label),
        h('div', { className: 'dsh-us-card-value', title: props.title }, compactTokens(props.value)),
        props.hint === undefined ? null : h('div', { className: 'dsh-us-card-hint' }, props.hint))
    }

    function Header(props) {
      return h('div', { className: 'dsh-us-head' },
        h('div', null,
          h('h2', { className: 'dsh-us-title' }, '用量统计'),
          h('p', { className: 'dsh-us-sub' }, '最近 30 天 · OpenCode Console 官方数据 · 按 UTC 日期（与官网图表一致）')),
        h('button', {
          type: 'button',
          className: 'dsh-us-btn',
          disabled: props.loading,
          onClick: props.onRefresh,
        }, props.loading ? '刷新中…' : '刷新'))
    }

    function LoadingRow(props) {
      return h('div', { className: 'dsh-us-group' },
        h('div', { className: 'dsh-us-loading' },
          h('div', null, '正在从 OpenCode Console 拉取最近 30 天数据…'),
          h('div', { className: 'dsh-us-note' },
            '首次加载需要逐日读取请求日志，通常 10 秒左右；结果会缓存 10 分钟。',
            props.elapsed > 0 ? `（已等待 ${props.elapsed} 秒）` : '')))
    }

    function ErrorRow(props) {
      return h('div', { className: 'dsh-us-group' },
        h('div', { className: 'dsh-us-empty' },
          h('div', { className: 'dsh-us-error', role: 'alert' }, props.message),
          h('div', { style: { marginTop: '12px' } },
            h('button', { type: 'button', className: 'dsh-us-btn', onClick: props.onRetry }, '重试'))))
    }

    function SummaryCards(data) {
      return h('div', { className: 'dsh-us-cards' },
        h(Card, { label: '总 Token', value: data.summary.total }),
        h(Card, { label: '输入（不含缓存）', value: data.summary.input }),
        h(Card, { label: '输出（含 reasoning）', value: data.summary.output }),
        h(Card, { label: '缓存读', value: data.summary.cacheRead }),
        h(Card, { label: '请求数', value: data.summary.requests, title: fullNumber(data.summary.requests) }))
    }

    function MetaLine(data) {
      const items = [
        h('span', { key: 'range' }, h('strong', null, `${data.range.from} ~ ${data.range.to}`), ' · UTC'),
      ]
      if (data.go !== undefined) {
        items.push(h('span', { key: 'go' },
          h('strong', null, `官方 Go 周期（自 ${data.go.startsAt.slice(0, 10)}）`),
          `：${compactTokens(data.go.totalTokens)} tokens · ${fullNumber(data.go.totalRequests)} 次请求 · 额度消耗 ${formatMoney(data.go.totalCostMicroCents)}`))
      }
      items.push(h('span', { key: 'asof' }, `数据截至 ${data.asOf.slice(0, 19).replace('T', ' ')} UTC`))
      return h('div', { className: 'dsh-us-meta' }, items)
    }

    function MetricControls(props) {
      return h('div', { className: 'dsh-us-controls' },
        h('span', { className: 'dsh-us-controls-label' }, '口径'),
        METRICS.map(item => h('button', {
          key: item.id,
          type: 'button',
          className: 'dsh-us-btn',
          'aria-pressed': props.metric === item.id,
          onClick: () => props.onChange(item.id),
        }, item.label)))
    }

    function TableSection(props) {
      return h('div', { className: 'dsh-us-group' },
        h('div', { className: 'dsh-us-group-head' },
          h('h3', { className: 'dsh-us-group-title' }, props.title),
          h('span', { className: 'dsh-us-group-note' }, props.note)),
        h('div', { className: 'dsh-us-scroll' }, props.children))
    }

    function ModelTable(data) {
      const head = h('thead', null, h('tr', null, [
        h('th', { key: 'model' }, '模型'),
        h('th', { key: 'total' }, '总 Token'),
        h('th', { key: 'input' }, '输入'),
        h('th', { key: 'output' }, '输出'),
        h('th', { key: 'cache' }, '缓存读'),
        h('th', { key: 'requests' }, '请求'),
        h('th', { key: 'share' }, '占比'),
      ]))
      const rows = data.models.map(model => {
        const share = data.summary.total === 0 ? 0 : (model.totalTokens / data.summary.total) * 100
        const providers = model.providers.length === 0 ? null
          : h('span', { className: 'dsh-us-model-provider' }, model.providers.join(' · '))
        return h('tr', { key: model.id }, [
          h('td', { key: 'model' }, h('div', { className: 'dsh-us-model' },
            h('span', { className: 'dsh-us-model-name' }, model.id), providers)),
          h('td', { key: 'total', title: fullNumber(model.totalTokens) }, compactTokens(model.totalTokens)),
          h('td', { key: 'input', title: fullNumber(model.inputTokens) }, compactTokens(model.inputTokens)),
          h('td', { key: 'output', title: fullNumber(model.outputTokens) }, compactTokens(model.outputTokens)),
          h('td', { key: 'cache', title: fullNumber(model.cacheReadTokens) }, compactTokens(model.cacheReadTokens)),
          h('td', { key: 'requests' }, fullNumber(model.requests)),
          h('td', { key: 'share' },
            h('span', { className: 'dsh-us-bar' }, h('span', { style: { width: `${Math.max(2, share)}%` } })),
            `${share.toFixed(1)}%`),
        ])
      })
      const totalRow = h('tr', { className: 'dsh-us-total' }, [
        h('td', { key: 'model' }, '合计'),
        h('td', { key: 'total' }, compactTokens(data.summary.total)),
        h('td', { key: 'input' }, compactTokens(data.summary.input)),
        h('td', { key: 'output' }, compactTokens(data.summary.output)),
        h('td', { key: 'cache' }, compactTokens(data.summary.cacheRead)),
        h('td', { key: 'requests' }, fullNumber(data.summary.requests)),
        h('td', { key: 'share' }, '100%'),
      ])
      return h('table', { className: 'dsh-us-table' }, head, h('tbody', null, [...rows, totalRow]))
    }

    function MatrixTable(props) {
      const { data, layout, metric } = props
      const head = h('thead', null, h('tr', null, [
        h('th', { key: 'date' }, '日期'),
        ...layout.columns.map(id => h('th', { key: id }, layout.labelOf(id))),
        h('th', { key: 'total' }, '合计'),
      ]))
      const rows = layout.rows.map(row => {
        const today = row.date === data.range.to
        const dateCell = h('td', { key: 'date', className: today ? 'dsh-us-today' : 'dsh-us-date' },
          today ? `${row.date.slice(5)} · 今天` : row.date.slice(5))
        const cells = layout.columns.map(id => {
          const value = layout.valueOf(row, id)
          return h('td', { key: id, title: fullNumber(value) },
            value === 0 ? h('span', { className: 'dsh-us-zero' }, '-') : compactTokens(value))
        })
        return h('tr', { key: row.date }, [dateCell, ...cells, h('td', { key: 'total' }, compactTokens(metricOf(row.totals, metric)))])
      })
      const totalRow = h('tr', { className: 'dsh-us-total' }, [
        h('td', { key: 'date' }, '合计'),
        ...layout.columns.map((id, index) => h('td', { key: id }, compactTokens(layout.columnTotals[index]))),
        h('td', { key: 'total' }, compactTokens(layout.grandTotal)),
      ])
      return h('table', { className: 'dsh-us-table' }, head, h('tbody', null, [...rows, totalRow]))
    }

    function Warnings(data) {
      if (data.warnings.length === 0) return null
      return h('div', { className: 'dsh-us-warn', role: 'status' },
        data.warnings.map((warning, index) => h('div', { key: index }, `· ${warning}`)))
    }

    function Footnote() {
      return h('div', { className: 'dsh-us-note' },
        '数据来源：opencode.ai Console API（activity/go、request-logs，product=go）。',
        'token 均为计费口径：输入不含缓存读写，输出含 reasoning，缓存读/写单列。',
        '请求日志保留最近 30 天，因此本页上限即 30 天回滚窗口；页面结果缓存 10 分钟。')
    }

    function UsageSection() {
      const [state, setState] = useState({ phase: 'loading', data: undefined, error: undefined })
      const [metric, setMetric] = useState('total')
      const [elapsed, setElapsed] = useState(0)
      const abortRef = useRef(undefined)

      const load = useCallback(async (force) => {
        if (abortRef.current !== undefined) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        const startedAt = Date.now()
        setElapsed(0)
        setState({ phase: 'loading', data: undefined, error: undefined })
        const timer = setInterval(() => { setElapsed(Math.round((Date.now() - startedAt) / 1000)) }, 1000)
        try {
          const url = new URL(`usage-stats/api/data?days=30${force ? '&force=1' : ''}`, document.baseURI)
          const response = await fetch(url.href, { signal: controller.signal })
          const payload = await response.json().catch(() => undefined)
          if (!response.ok || payload === undefined || payload.ok !== true) {
            throw new Error(payload === undefined ? `HTTP ${response.status}` : (payload.error?.message ?? `HTTP ${response.status}`))
          }
          if (!controller.signal.aborted) setState({ phase: 'ready', data: payload.data, error: undefined })
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          if (!controller.signal.aborted) {
            setState({ phase: 'error', data: undefined, error: error instanceof Error ? error.message : String(error) })
          }
        } finally {
          clearInterval(timer)
          if (!controller.signal.aborted) setElapsed(0)
          if (abortRef.current === controller) abortRef.current = undefined
        }
      }, [])

      useEffect(() => {
        load(false)
        return () => {
          if (abortRef.current !== undefined) abortRef.current.abort()
        }
      }, [load])

      const data = state.data
      const layout = useMemo(() => {
        if (data === undefined) return undefined
        const visible = data.models.filter(model => model.totalTokens > 0)
        const maxColumns = 10
        const columns = visible.length <= maxColumns
          ? visible.map(model => model.id)
          : [...visible.slice(0, maxColumns - 1).map(model => model.id), '__other__']
        const hidden = new Set(visible.length <= maxColumns ? [] : visible.slice(maxColumns - 1).map(model => model.id))
        const labelOf = id => (id === '__other__' ? '其他' : id)
        const valueOf = (row, id) => {
          if (id !== '__other__') return metricOf(row.byModel?.[id], metric)
          let sum = 0
          for (const [modelId, bucket] of Object.entries(row.byModel ?? {})) {
            if (hidden.has(modelId)) sum += metricOf(bucket, metric)
          }
          return sum
        }
        const columnTotals = columns.map(id => data.daily.reduce((sum, row) => sum + valueOf(row, id), 0))
        const grandTotal = data.daily.reduce((sum, row) => sum + metricOf(row.totals, metric), 0)
        return { columns, labelOf, valueOf, columnTotals, grandTotal, rows: [...data.daily].reverse() }
      }, [data, metric])

      const parts = [
        h('style', { key: 'css' }, CSS),
        h(Header, { key: 'head', loading: state.phase === 'loading', onRefresh: () => { load(true) } }),
      ]

      if (state.phase === 'loading') {
        parts.push(h(LoadingRow, { key: 'loading', elapsed }))
      } else if (state.phase === 'error') {
        parts.push(h(ErrorRow, { key: 'error', message: state.error, onRetry: () => { load(true) } }))
      } else if (data !== undefined) {
        parts.push(h(SummaryCards, { key: 'cards', ...data }))
        parts.push(h(MetaLine, { key: 'meta', ...data }))
        parts.push(h(MetricControls, { key: 'metric', metric, onChange: setMetric }))
        if (data.summary.total === 0) {
          parts.push(h('div', { key: 'empty', className: 'dsh-us-group' },
            h('div', { className: 'dsh-us-empty' }, '最近 30 天没有可统计的 Go 推理记录（request-logs 只保留最近 30 天）。')))
        }
        parts.push(h(TableSection, {
          key: 'models',
          title: '按模型',
          note: `${data.models.length} 个模型 · 占比按总 token`,
        }, h(ModelTable, data)))
        if (layout !== undefined) {
          const metricLabel = METRICS.find(item => item.id === metric)?.label ?? '总计'
          parts.push(h(TableSection, {
            key: 'matrix',
            title: `日 × 模型（${metricLabel}）`,
            note: '横向滚动查看全部模型 · 空值显示为 -',
          }, h(MatrixTable, { data, layout, metric })))
        }
        parts.push(h(Warnings, { key: 'warnings', ...data }))
        parts.push(h(Footnote, { key: 'note' }))
      }

      return h('div', { className: 'dsh-us' }, parts)
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'usage-stats',
          order: 150,
          label: () => '用量统计',
        }, UsageSection))
      },
    }
  },
})
