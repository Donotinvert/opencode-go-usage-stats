window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

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
.dsh-us-sub{margin:2px 0 0;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
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
.dsh-us-scroll{overflow:auto;max-height:380px}
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
.dsh-us-footbtn{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;height:36px;padding:0 8px;margin:2px 0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#59636e);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden}
.dsh-us-footbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-footbtn[data-wide="false"]{justify-content:center;padding:0}
.dsh-us-footbtn-icon{display:flex;flex:none}
.dsh-us-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.3)}
.dsh-us-modal{display:flex;flex-direction:column;width:min(1000px,94vw);max-height:88vh;border:1px solid var(--dsw-alias-border-l2,#d8dee4);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-modalhead{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2,#d8dee4)}
.dsh-us-modalhead .dsh-us-head{flex:1;align-items:center}
.dsh-us-modalbody{padding:16px 18px 20px;overflow:auto}
.dsh-us-modalbody .dsh-us{font-size:13px}
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

    /**
     * Shared UI state: panel visibility, loaded payload and the selected metric.
     * One instance per plugin activation serves the sidebar button, the overlay
     * and the settings page, so they never fetch or disagree independently.
     */
    function createController() {
      let snapshot = { open: false, phase: 'idle', data: undefined, error: undefined, refreshing: false, metric: 'total' }
      const listeners = new Set()
      let inflight
      let lastFetchAt = 0

      const emit = () => {
        for (const listener of [...listeners]) listener()
      }
      const set = (patch) => {
        snapshot = { ...snapshot, ...patch }
        emit()
      }

      const load = (force) => {
        if (inflight !== undefined) return inflight
        const firstLoad = snapshot.data === undefined
        set({ phase: firstLoad ? 'loading' : 'ready', error: undefined, refreshing: !firstLoad })
        const url = new URL(`usage-stats/api/data?days=30${force === true ? '&force=1' : ''}`, document.baseURI)
        inflight = fetch(url.href)
          .then(async (response) => {
            const payload = await response.json().catch(() => undefined)
            if (!response.ok || payload === undefined || payload.ok !== true) {
              throw new Error(payload === undefined ? `HTTP ${response.status}` : (payload.error?.message ?? `HTTP ${response.status}`))
            }
            lastFetchAt = Date.now()
            set({ phase: 'ready', data: payload.data, error: undefined, refreshing: false })
          })
          .catch((error) => {
            if (error instanceof DOMException && error.name === 'AbortError') return
            set({
              phase: snapshot.data === undefined ? 'error' : 'ready',
              error: error instanceof Error ? error.message : String(error),
              refreshing: false,
            })
          })
          .finally(() => {
            inflight = undefined
          })
        return inflight
      }

      const ensure = (force) => {
        if (force === true) return load(true)
        if (snapshot.data === undefined || Date.now() - lastFetchAt > 60_000) return load(false)
        return Promise.resolve()
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot() {
          return snapshot
        },
        open() {
          set({ open: true })
          void ensure(false)
        },
        close() {
          set({ open: false })
        },
        toggle() {
          if (snapshot.open) set({ open: false })
          else this.open()
        },
        refresh() {
          return load(true)
        },
        ensure,
        setMetric(metric) {
          set({ metric })
        },
        prefetch() {
          if (snapshot.data === undefined) void load(false)
        },
      }
    }

    function ChartIcon() {
      return h('svg', { className: 'dsh-us-footbtn-icon', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 3, y: 13, width: 4, height: 8, rx: 1, fill: 'currentColor', opacity: .45 }),
        h('rect', { x: 10, y: 8, width: 4, height: 13, rx: 1, fill: 'currentColor', opacity: .7 }),
        h('rect', { x: 17, y: 3, width: 4, height: 18, rx: 1, fill: 'currentColor' }))
    }

    function Card(props) {
      return h('div', { className: 'dsh-us-card' },
        h('div', { className: 'dsh-us-card-label' }, props.label),
        h('div', { className: 'dsh-us-card-value', title: props.title }, compactTokens(props.value)),
        props.hint === undefined ? null : h('div', { className: 'dsh-us-card-hint' }, props.hint))
    }

    function LoadingRow(props) {
      return h('div', { className: 'dsh-us-group' },
        h('div', { className: 'dsh-us-loading' },
          h('div', null, '正在从 OpenCode Console 拉取数据…'),
          h('div', { className: 'dsh-us-note' },
            '已有缓存时通常瞬间返回；首次安装或缓存过期时需要逐日拉取，约 10 秒。',
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
        '数据来源：opencode.ai Console API（activity/go、request-logs，Go 计划流量）。',
        'token 为计费口径：输入不含缓存读写，输出含 reasoning；按 UTC 日聚合。',
        'Host 端按天缓存：已完成日期直接命中，只有今天（和昨天收尾）会短 TTL 重拉；刷新按钮会强制补拉今天。')
    }

    /** The shared dashboard body: summary, model table and day-by-model matrix. */
    function UsageBody(props) {
      const controller = props.controller
      const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
      const [elapsed, setElapsed] = useState(0)
      const loading = snapshot.phase === 'loading'
      const data = snapshot.data

      useEffect(() => {
        if (!loading) return undefined
        const startedAt = Date.now()
        const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000)
        return () => {
          clearInterval(timer)
          setElapsed(0)
        }
      }, [loading])

      useEffect(() => {
        controller.ensure(false)
      }, [controller])

      const layout = useMemo(() => {
        if (data === undefined) return undefined
        const metric = snapshot.metric
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
      }, [data, snapshot.metric])

      if (snapshot.phase === 'error' && data === undefined) {
        return h(ErrorRow, { message: snapshot.error, onRetry: () => { void controller.refresh() } })
      }
      if (loading && data === undefined) {
        return h(LoadingRow, { elapsed })
      }
      if (data === undefined) {
        return h(LoadingRow, { elapsed })
      }

      const parts = []
      if (snapshot.error !== undefined) {
        parts.push(h('div', { key: 'err', className: 'dsh-us-error', role: 'alert' }, snapshot.error))
      }
      parts.push(h(SummaryCards, { key: 'cards', ...data }))
      parts.push(h(MetaLine, { key: 'meta', ...data }))
      parts.push(h(MetricControls, { key: 'metric', metric: snapshot.metric, onChange: (value) => controller.setMetric(value) }))
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
        const metricLabel = METRICS.find(item => item.id === snapshot.metric)?.label ?? '总计'
        parts.push(h(TableSection, {
          key: 'matrix',
          title: `日 × 模型（${metricLabel}）`,
          note: '横向滚动查看全部模型 · 空值显示为 -',
        }, h(MatrixTable, { data, layout, metric: snapshot.metric })))
      }
      if (snapshot.refreshing) {
        parts.push(h('div', { key: 'refreshing', className: 'dsh-us-note' }, '正在后台刷新今天的数据…'))
      }
      parts.push(h(Warnings, { key: 'warnings', ...data }))
      parts.push(h(Footnote, { key: 'note' }))
      return parts
    }

    function SettingsSection(props) {
      const controller = props.controller
      const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
      return h('div', { className: 'dsh-us' },
        h('style', null, CSS),
        h('div', { className: 'dsh-us-head' },
          h('div', null,
            h('h2', { className: 'dsh-us-title' }, '用量统计'),
            h('p', { className: 'dsh-us-sub' }, '最近 30 天 · OpenCode Console 官方数据 · UTC 日期')),
          h('button', {
            type: 'button',
            className: 'dsh-us-btn',
            disabled: snapshot.refreshing || snapshot.phase === 'loading',
            onClick: () => { void controller.refresh() },
          }, snapshot.refreshing || snapshot.phase === 'loading' ? '刷新中…' : '刷新')),
        h(UsageBody, { controller }))
    }

    function FooterButton(props) {
      const controller = props.controller
      const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
      const total = snapshot.data?.summary?.total
      const hint = `用量统计${total === undefined ? '' : ` · 近30天 ${compactTokens(total)}`}（Ctrl+Shift+G）`
      return h('div', null,
        h('style', null, CSS),
        h('button', {
          type: 'button',
          className: 'dsh-us-footbtn',
          'data-wide': props.wide === false ? 'false' : 'true',
          title: hint,
          'aria-label': hint,
          onClick: () => controller.toggle(),
        },
        h(ChartIcon, null),
        props.wide === false ? null : h('span', null, '用量')))
    }

    function OverlayHost(props) {
      const controller = props.controller
      const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
      const open = snapshot.open

      useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          controller.close()
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
      }, [open, controller])

      if (!open) return null
      return h('div', {
        className: 'dsh-us-overlay',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) controller.close()
        },
      },
      h('style', null, CSS),
      h('div', { className: 'dsh-us-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '用量统计' },
        h('div', { className: 'dsh-us-modalhead' },
          h('div', { className: 'dsh-us-head' },
            h('div', null,
              h('h2', { className: 'dsh-us-title' }, '用量统计'),
              h('p', { className: 'dsh-us-sub' }, '最近 30 天 · OpenCode Console 官方数据 · UTC 日期'))),
          h('button', {
            type: 'button',
            className: 'dsh-us-btn',
            disabled: snapshot.refreshing || snapshot.phase === 'loading',
            onClick: () => { void controller.refresh() },
          }, snapshot.refreshing || snapshot.phase === 'loading' ? '刷新中…' : '刷新'),
          h('button', { type: 'button', className: 'dsh-us-btn', onClick: () => controller.close() }, '关闭')),
        h('div', { className: 'dsh-us-modalbody' },
          h(UsageBody, { controller }))))
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const controller = createController()

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'usage-stats',
          order: 150,
          label: () => '用量统计',
          inject: () => ({ controller }),
        }, SettingsSection))

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'usage-stats',
          order: 20,
          inject: () => ({ controller }),
        }, FooterButton))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'usage-stats-panel',
          inject: () => ({ controller }),
        }, OverlayHost))

        /* Ctrl+Shift+G (Cmd+Shift+G on macOS) through the host shortcut service. */
        ctx.inject(['shortcuts'], (scope) => {
          scope.effect(() => {
            try {
              return scope.shortcuts.register({
                id: 'usage-stats.open',
                label: () => '用量统计',
                aliases: ['opencode go usage', 'usage stats'],
                defaults: {
                  'desktop:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                  'desktop:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                  'desktop:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                  'web:windows': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                  'web:macos': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                  'web:linux': { code: 'KeyG', modifiers: ['primary', 'shift'] },
                },
                regions: ['page', 'editable'],
                modals: [],
                resolve: () => ({ status: 'handled', run: () => controller.toggle() }),
              })
            } catch {
              /* A user override may already own the chord; the button still works. */
              return () => {}
            }
          }, 'dsh-opencode-go-usage: shortcut')
        })

        /* Prefetch after the page settles, so the first click usually has data. */
        ctx.effect(() => {
          const timer = setTimeout(() => controller.prefetch(), 1200)
          return () => clearTimeout(timer)
        }, 'dsh-opencode-go-usage: prefetch')
      },
    }
  },
})
