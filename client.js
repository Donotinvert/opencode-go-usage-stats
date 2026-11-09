window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    const METRICS = [
      { id: 'total', label: '总计' },
      { id: 'input', label: '输入' },
      { id: 'output', label: '输出' },
      { id: 'cacheRead', label: '缓存读' },
    ]

    /* Theme-aware series palette: brand-black/teal/red on light, white/teal/red
       on dark (see the --dsh-us-series-* blocks in CSS). The first slot also
       colours the sidebar ring, so icon and chart always match. */
    const SERIES_COLORS = [
      'var(--dsh-us-series-0,#4d6bfe)',
      'var(--dsh-us-series-1,#0f9d8a)',
      'var(--dsh-us-series-2,#d13438)',
      'var(--dsh-us-series-3,#94a3b8)',
    ]
    const TOP_MODELS = 3

    /** Go plan quota windows, in the order the quota row shows them. */
    const QUOTA_WINDOWS = [
      { id: 'rolling', label: '5 小时' },
      { id: 'weekly', label: '每周' },
      { id: 'monthly', label: '每月' },
    ]

    const CSS = `
.dsh-us{display:flex;flex-direction:column;gap:16px;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.5}
.dsh-us *{box-sizing:border-box}
.dsh-us,.dsh-us-footwrap,.dsh-us-overlay{--dsh-us-series-0:var(--dsw-alias-brand-primary,#1f2328);--dsh-us-series-1:#0f9d8a;--dsh-us-series-2:#d13438;--dsh-us-series-3:#94a3b8;--dsh-us-quota-ink:#1f2328}
body[data-ds-dark-theme] .dsh-us,body[data-ds-dark-theme] .dsh-us-footwrap,body[data-ds-dark-theme] .dsh-us-overlay{--dsh-us-series-0:var(--dsw-alias-brand-primary,#ffffff);--dsh-us-series-1:#12a594;--dsh-us-series-2:#e5484d;--dsh-us-series-3:var(--dsw-alias-label-tertiary,#94a3b8);--dsh-us-quota-ink:#ffffff}
.dsh-us-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.dsh-us-title{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em}
.dsh-us-sub{margin:2px 0 0;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#d8dee4);background:var(--dsw-alias-bg-layer-2,#fff);color:inherit;font:inherit;font-size:12px;border-radius:8px;padding:5px 12px;cursor:pointer;white-space:nowrap}
.dsh-us-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.dsh-us-btn:disabled{opacity:.55;cursor:default}
.dsh-us-btn[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:var(--dsw-alias-brand-primary,#4d6bfe);background:transparent}
.dsh-us-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.dsh-us-sum{display:flex;flex-direction:column;gap:6px;border:.5px solid var(--dsw-alias-settings-card-stroke,#d8dee4);background:var(--dsw-alias-settings-card-fill,#fff);border-radius:12px;padding:12px 14px}
.dsh-us-sum-today{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsh-us-sum-head{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-sum-value{font-size:26px;font-weight:600;line-height:1.15;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.dsh-us-sum-unit{margin-left:5px;color:var(--dsw-alias-label-tertiary,#818b98);font-size:12px;font-weight:400;letter-spacing:0}
.dsh-us-sum-sub{color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-sum-split{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:2px;padding-top:8px;border-top:.5px dashed var(--dsw-alias-border-l2,#d8dee4)}
.dsh-us-sum-item{display:inline-flex;align-items:baseline;gap:5px;font-size:12px;font-variant-numeric:tabular-nums}
.dsh-us-sum-item span{color:var(--dsw-alias-label-tertiary,#818b98)}
.dsh-us-sum-item b{font-weight:600}
.dsh-us-quota{display:flex;flex-direction:column;gap:10px;border:.5px solid var(--dsw-alias-settings-card-stroke,#d8dee4);background:var(--dsw-alias-settings-card-fill,#fff);border-radius:12px;padding:12px 14px}
.dsh-us-quota-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dsh-us-quota-title{margin:0;font-size:13px;font-weight:600}
.dsh-us-quota-note{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px}
.dsh-us-quota-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.dsh-us-quota-item{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-us-quota-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#59636e)}
.dsh-us-quota-value{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;font-variant-numeric:tabular-nums}
.dsh-us-quota-track{height:6px;border-radius:999px;border:1px solid var(--dsh-us-quota-ink,#fff);background:transparent;overflow:hidden}
.dsh-us-quota-fill{height:100%;border-radius:999px;background:var(--dsh-us-quota-ink,#fff);transition:width .2s ease}
.dsh-us-quota-reset{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px;font-variant-numeric:tabular-nums}
@media (max-width:560px){.dsh-us-quota-row{grid-template-columns:1fr}}
.dsh-us-meta{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-meta strong{color:var(--dsw-alias-label-primary,#1f2328);font-weight:600}
.dsh-us-controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dsh-us-controls-label{color:var(--dsw-alias-label-secondary,#59636e);font-size:12px;margin-right:2px}
.dsh-us-group{border:.5px solid var(--dsw-alias-settings-card-stroke,#d8dee4);background:var(--dsw-alias-settings-card-fill,#fff);border-radius:12px;padding:12px 14px 10px}
.dsh-us-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:4px}
.dsh-us-group-title{margin:0;font-size:13px;font-weight:600}
.dsh-us-group-note{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px}
.dsh-us-plot{position:relative}
.dsh-us-chart{display:flex;align-items:flex-end;gap:3px;height:200px;padding:0 2px}
.dsh-us-avg{position:absolute;left:2px;right:2px;height:0;border-top:1px dashed var(--dsw-alias-border-l2,#d8dee4);pointer-events:none}
.dsh-us-col-today .dsh-us-stack{box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#4d6bfe)}
.dsh-us-axis-today{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:600}
.dsh-us-readout-delta{color:var(--dsw-alias-label-tertiary,#818b98)}
.dsh-us-col{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end;cursor:default}
.dsh-us-stack{display:flex;flex-direction:column-reverse;width:100%;height:100%;border-radius:4px 4px 2px 2px;overflow:hidden}
.dsh-us-col:hover .dsh-us-stack{filter:brightness(1.06)}
.dsh-us-col-active .dsh-us-stack{outline:1px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}
.dsh-us-seg{width:100%;min-height:0}
.dsh-us-seg-empty{width:100%;height:2px;background:var(--dsw-alias-bg-l2,#eef1f4);border-radius:2px}
.dsh-us-axis{display:flex;gap:3px;padding:4px 2px 0;color:var(--dsw-alias-label-tertiary,#818b98);font-size:10px;height:16px}
.dsh-us-axis span{flex:1;text-align:center;white-space:nowrap;overflow:visible}
.dsh-us-readout{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:baseline;min-height:20px;padding:8px 2px 0;color:var(--dsw-alias-label-secondary,#59636e);font-size:12px}
.dsh-us-readout strong{color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-readout-item{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}
.dsh-us-swatch{width:10px;height:10px;border-radius:3px;flex:none;display:inline-block}
.dsh-us-legend{display:flex;flex-wrap:wrap;gap:8px 18px;padding:10px 2px 0;border-top:.5px solid var(--dsw-alias-border-l2,#d8dee4);margin-top:8px}
.dsh-us-legend-item{display:flex;align-items:center;gap:6px;min-width:0;font-size:12px}
.dsh-us-legend-name{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-legend-value{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-legend-share{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#818b98)}
.dsh-us-empty{padding:24px 14px;text-align:center;color:var(--dsw-alias-label-secondary,#59636e)}
.dsh-us-error{border:1px solid var(--dsw-alias-state-error-primary,#cf222e);color:var(--dsw-alias-state-error-primary,#cf222e);border-radius:10px;padding:12px 14px;font-size:12px;word-break:break-word}
.dsh-us-warn{color:var(--dsw-alias-state-warn-label,#9a6700);font-size:12px}
.dsh-us-note{color:var(--dsw-alias-label-tertiary,#818b98);font-size:11px;line-height:1.6}
.dsh-us-loading{display:flex;flex-direction:column;gap:6px;padding:18px 14px;color:var(--dsw-alias-label-secondary,#59636e)}
.dsh-us-footbtn{display:flex;align-items:center;justify-content:flex-start;gap:8px;width:100%;height:36px;padding:0 8px;margin:2px 0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#59636e);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden}
.dsh-us-footbtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-footbtn[data-wide="false"]{justify-content:center;padding:0}
.dsh-us-footbtn-icon{display:flex;flex:none}
.dsh-us-footwrap{display:block;width:100%;min-width:0}
.dsh-us-quota-card{position:fixed;z-index:1200;display:none;min-width:168px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,#3a3a3a);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#2b2b2b);box-shadow:0 12px 36px rgba(0,0,0,.38);color:var(--dsw-alias-label-primary,#f2f2f2);font-size:12px;line-height:1.5}
.dsh-us-quota-card[data-open="true"]{display:block}
.dsh-us-quota-line{display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:1px 0}
.dsh-us-quota-line span{color:var(--dsw-alias-label-secondary,#9a9a9a)}
.dsh-us-quota-line b{font-weight:600;font-variant-numeric:tabular-nums}
.dsh-us-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.3)}
.dsh-us-modal{display:flex;flex-direction:column;width:min(1000px,94vw);max-height:88vh;border:1px solid var(--dsw-alias-border-l2,#d8dee4);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 24px 80px rgba(0,0,0,.28);overflow:hidden;color:var(--dsw-alias-label-primary,#1f2328)}
.dsh-us-modalhead{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l2,#d8dee4)}
.dsh-us-modalhead .dsh-us-head{flex:1;align-items:center}
.dsh-us-modalbody{padding:16px 18px 20px;overflow:auto}
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

    /** Today's UTC date key, matching the Console's own daily boundary. */
    function utcDateString(date) {
      return date.toISOString().slice(0, 10)
    }

    function signedPercent(value) {
      return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`
    }

    function formatMoney(microCents) {
      return `$${((Number(microCents) || 0) / 1e8).toFixed(2)}`
    }

    function metricOf(bucket, metric) {
      if (bucket === undefined || bucket === null) return 0
      const field = metric === 'input' ? 'input' : metric === 'output' ? 'output' : metric === 'cacheRead' ? 'cacheRead' : 'total'
      return Number(bucket[field]) || 0
    }

    /** Same measure as {@link metricOf}, read from a summary model row. */
    function metricOfModel(model, metric) {
      if (model === undefined || model === null) return 0
      const field = metric === 'input' ? 'inputTokens' : metric === 'output' ? 'outputTokens' : metric === 'cacheRead' ? 'cacheReadTokens' : 'totalTokens'
      return Number(model[field]) || 0
    }

    /**
     * Shared UI state: panel visibility, loaded payload and the selected metric.
     * One instance per plugin activation serves the sidebar button, the overlay
     * and the settings page, so they never fetch or disagree independently.
     */
    function createController() {
      let snapshot = {
        open: false, phase: 'idle', data: undefined, error: undefined,
        refreshing: false, metric: 'total', quota: undefined, quotaError: undefined,
      }
      const listeners = new Set()
      let inflight
      let lastFetchAt = 0
      let quotaInflight
      let quotaTimer

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

      /**
       * Quota windows change every minute and are independent of the 30-day
       * token aggregates, so they get their own endpoint and poll interval.
       */
      const loadQuota = () => {
        if (quotaInflight !== undefined) return quotaInflight
        quotaInflight = fetch(new URL('usage-stats/api/quota', document.baseURI).href)
          .then(async (response) => {
            const payload = await response.json().catch(() => undefined)
            if (!response.ok || payload === undefined || payload.ok !== true) {
              throw new Error(payload === undefined ? `HTTP ${response.status}` : (payload.error?.message ?? `HTTP ${response.status}`))
            }
            set({ quota: payload.data, quotaError: undefined })
          })
          .catch((error) => {
            set({ quotaError: error instanceof Error ? error.message : String(error) })
          })
          .finally(() => {
            quotaInflight = undefined
          })
        return quotaInflight
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          if (quotaTimer === undefined) {
            void loadQuota()
            quotaTimer = setInterval(() => { void loadQuota() }, 60_000)
          }
          return () => {
            listeners.delete(listener)
            if (listeners.size === 0 && quotaTimer !== undefined) {
              clearInterval(quotaTimer)
              quotaTimer = undefined
            }
          }
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

    /** `MM-DD HH:mm` in the reader's local time zone. */
    function formatReset(resetsAt) {
      const date = new Date(resetsAt)
      if (!Number.isFinite(date.getTime())) return '--'
      const pad = (value) => String(value).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function clockOf(iso) {
      const formatted = formatReset(iso)
      return formatted.includes(' ') ? formatted.split(' ')[1] : formatted
    }

    function quotaPercent(quota, id) {
      const percent = Number(quota?.windows?.[id]?.percent)
      return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
    }

    /**
     * Compact quota popover shown to the right of the sidebar button on hover:
     * three short rows only (label + remaining %). Clicking the icon opens the
     * full dashboard, so the card carries no source line, dividers or actions.
     */
    function QuotaHoverCard(props) {
      const quota = props.quota
      const rows = QUOTA_WINDOWS.map(item => {
        const window = quota.windows?.[item.id]
        const left = Math.max(0, Math.round(100 - quotaPercent(quota, item.id)))
        return h('div', { key: item.id, className: 'dsh-us-quota-line' },
          h('span', null, item.label),
          h('b', null, window?.status === 'rate-limited' ? '已用尽' : `剩 ${left}%`))
      })
      return h('div', {
        className: 'dsh-us-quota-card',
        'data-open': props.open ? 'true' : 'false',
        style: props.anchor === undefined ? undefined : { left: `${props.anchor.left}px`, bottom: `${props.anchor.bottom}px` },
        role: 'tooltip',
      }, rows)
    }

    /**
     * Sidebar icon: two half-rings. The top arc is the 5-hour window and the
     * bottom arc the monthly window, both filled by the REMAINING percentage —
     * the same "white = quota left" reading as the quota bars, so a nearly
     * unused plan draws an almost complete white ring. The arcs stop ~18°
     * short of the horizontal so the halves stay readable apart.
     */
    function UsageRing(props) {
      const quota = props.quota
      const arc = (path, id, track) => h('path', {
        d: path,
        pathLength: 100,
        fill: 'none',
        /* Same color as the chart's first series, so the icon and the opened
           bars read as one palette (the theme brand token, white on dark). */
        stroke: SERIES_COLORS[0],
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeOpacity: track ? .22 : 1,
        strokeDasharray: track ? undefined : `${100 - quotaPercent(quota, id)} 100`,
      })
      const top = 'M 3.44 9.22 A 9 9 0 0 1 20.56 9.22'
      const bottom = 'M 3.44 14.78 A 9 9 0 0 0 20.56 14.78'
      return h('svg', { className: 'dsh-us-footbtn-icon', width: 26, height: 26, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        arc(top, 'rolling', true),
        arc(top, 'rolling', false),
        arc(bottom, 'monthly', true),
        arc(bottom, 'monthly', false))
    }

    function SummaryBlock(props) {
      return h('div', { className: `dsh-us-sum${props.today ? ' dsh-us-sum-today' : ''}` },
        h('div', { className: 'dsh-us-sum-head' },
          h('span', null, props.label)),
        h('div', { className: 'dsh-us-sum-value' },
          compactTokens(props.value),
          h('span', { className: 'dsh-us-sum-unit' }, 'tokens')),
        h('div', { className: 'dsh-us-sum-sub' }, props.sub),
        h('div', { className: 'dsh-us-sum-split' },
          props.splits.map(item => h('span', { key: item.label, className: 'dsh-us-sum-item' },
            h('span', { title: item.hint }, item.label),
            h('b', null, compactTokens(item.value))))))
    }

    /**
     * Two blocks side by side: the whole 30-day window on the left and today's
     * partial UTC day on the right, so both totals are read at a glance.
     */
    function SummarySection(data) {
      const todayDate = utcDateString(new Date())
      const rows = data.daily ?? []
      const todayRow = rows.find(row => row.date === todayDate) ?? rows[rows.length - 1]
      const todayTotals = todayRow === undefined ? undefined : todayRow.totals
      const pastRows = rows.filter(row => row !== todayRow)
      const average = pastRows.length === 0
        ? 0
        : pastRows.reduce((sum, row) => sum + metricOf(row.totals, 'total'), 0) / pastRows.length
      const todayTotal = metricOf(todayTotals, 'total')
      const todayDateKey = todayRow === undefined ? todayDate : todayRow.date
      const todayLabel = `${todayDateKey === todayDate ? '今日' : '最近一日'} · ${todayDateKey.slice(5)}（UTC）`
      const share = data.summary.total === 0 ? 0 : (todayTotal / data.summary.total) * 100
      const delta = average === 0 ? undefined : ((todayTotal - average) / average) * 100
      const todaySub = [`占 30 天 ${share.toFixed(1)}%`]
      if (delta !== undefined) todaySub.push(`较前 ${pastRows.length} 天日均 ${signedPercent(delta)}`)
      const splitsOf = totals => [
        { label: '输入', value: metricOf(totals, 'input'), hint: '输入不含缓存读写' },
        { label: '输出', value: metricOf(totals, 'output'), hint: '输出含 reasoning' },
        { label: '缓存读', value: metricOf(totals, 'cacheRead'), hint: '缓存读取的 token' },
      ]
      return h('div', { className: 'dsh-us-summary' },
        h(SummaryBlock, {
          key: 'window',
          label: `最近 ${data.days ?? 30} 天累计`,
          value: data.summary.total,
          sub: `请求 ${fullNumber(data.summary.requests)} 次 · ${data.summary.models ?? data.models.length} 个模型`,
          splits: splitsOf(data.summary),
        }),
        h(SummaryBlock, {
          key: 'today',
          today: true,
          label: todayLabel,
          value: todayTotal,
          sub: todaySub.join(' · '),
          splits: splitsOf(todayTotals),
        }))
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

    /**
     * Daily stacked bar chart: one bar per UTC day, each bar split into the
     * period's top three models plus a merged "其他" slice (at most 4 series).
     * Hovering a bar shows that day's exact breakdown under the chart.
     */
    function DailyChart(props) {
      const { data, metric } = props
      const [hovered, setHovered] = useState(undefined)

      const layout = useMemo(() => {
        const ranked = data.models.filter(model => model.totalTokens > 0)
        const top = ranked.slice(0, TOP_MODELS)
        const otherModelIds = ranked.slice(TOP_MODELS).map(model => model.id)
        const series = top.map((model, index) => ({ id: model.id, label: model.id, color: SERIES_COLORS[index] }))
        if (otherModelIds.length > 0) series.push({ id: '__other__', label: '其他', color: SERIES_COLORS[3] })

        const points = data.daily.map((row) => {
          const segments = series.map((seriesItem) => {
            const value = seriesItem.id === '__other__'
              ? otherModelIds.reduce((sum, id) => sum + metricOf(row.byModel?.[id], metric), 0)
              : metricOf(row.byModel?.[seriesItem.id], metric)
            return { id: seriesItem.id, label: seriesItem.label, color: seriesItem.color, value }
          })
          const total = segments.reduce((sum, segment) => sum + segment.value, 0)
          return { date: row.date, segments, total }
        })
        const max = Math.max(1, ...points.map(point => point.total))
        const todayDate = utcDateString(new Date())
        const past = points.filter(point => point.date !== todayDate)
        const average = past.length === 0 ? 0 : past.reduce((sum, point) => sum + point.total, 0) / past.length
        /* The tallest bar keeps headroom, so bars and the average line share one value scale. */
        const chartMax = max * 1.08
        const grand = points.reduce((sum, point) => sum + point.total, 0)
        const legend = series.map((seriesItem) => {
          const value = seriesItem.id === '__other__'
            ? points.reduce((sum, point) => sum + (point.segments.find(segment => segment.id === '__other__')?.value ?? 0), 0)
            : metricOfModel(data.models.find(model => model.id === seriesItem.id), metric)
          return { ...seriesItem, value, share: grand === 0 ? 0 : (value / grand) * 100 }
        })
        return { points, max, chartMax, average, pastCount: past.length, todayDate, legend }
      }, [data, metric])

      const activeIndex = hovered === undefined ? layout.points.length - 1 : Math.min(hovered, layout.points.length - 1)
      const active = layout.points[activeIndex]
      const metricLabel = METRICS.find(item => item.id === metric)?.label ?? '总计'
      const activeDelta = active === undefined || layout.average === 0
        ? undefined
        : ((active.total - layout.average) / layout.average) * 100

      const readout = active === undefined ? null : h('div', { className: 'dsh-us-readout' },
        h('strong', null, active.date === layout.todayDate ? `${active.date}（今日，UTC）` : active.date),
        h('span', null, `合计 ${fullNumber(active.total)}`),
        activeDelta === undefined ? null : h('span', { className: 'dsh-us-readout-delta' },
          `较前 ${layout.pastCount} 天日均 ${signedPercent(activeDelta)}`),
        active.segments.filter(segment => segment.value > 0).map(segment => h('span', {
          key: segment.id,
          className: 'dsh-us-readout-item',
        },
        h('i', { className: 'dsh-us-swatch', style: { background: segment.color } }),
        `${segment.label} ${compactTokens(segment.value)}`)))

      return h('div', { className: 'dsh-us-group' },
        h('div', { className: 'dsh-us-group-head' },
          h('h3', { className: 'dsh-us-group-title' }, `日用量（${metricLabel}）`),
          h('span', { className: 'dsh-us-group-note' },
            layout.average === 0
              ? `峰值 ${compactTokens(layout.max)} · Top${TOP_MODELS} 模型 + 其他`
              : `峰值 ${compactTokens(layout.max)} · 日均 ${compactTokens(layout.average)} · Top${TOP_MODELS} 模型 + 其他`)),
        h('div', { className: 'dsh-us-plot' },
          h('div', { className: 'dsh-us-chart', onMouseLeave: () => setHovered(undefined) },
            layout.points.map((point, index) => {
              const segments = point.segments.filter(segment => segment.value > 0)
              const total = point.total
              return h('div', {
                key: point.date,
                className: `dsh-us-col${index === activeIndex ? ' dsh-us-col-active' : ''}${point.date === layout.todayDate ? ' dsh-us-col-today' : ''}`,
                onMouseEnter: () => setHovered(index),
                role: 'img',
                'aria-label': `${point.date} 合计 ${fullNumber(total)}`,
              },
              total === 0
                ? h('div', { className: 'dsh-us-seg-empty' })
                : h('div', { className: 'dsh-us-stack' },
                  segments.map(segment => h('div', {
                    key: segment.id,
                    className: 'dsh-us-seg',
                    style: { height: `${(segment.value / layout.chartMax) * 100}%`, background: segment.color },
                  }))))
            })),
          layout.average > 0 ? h('div', {
            className: 'dsh-us-avg',
            title: `过去 ${layout.pastCount} 天日均 ${fullNumber(layout.average)}`,
            style: { bottom: `${(layout.average / layout.chartMax) * 100}%` },
          }) : null),
        h('div', { className: 'dsh-us-axis' },
          layout.points.map((point, index) => h('span', {
            key: point.date,
            className: point.date === layout.todayDate ? 'dsh-us-axis-today' : undefined,
          }, index % 5 === 0 || index === layout.points.length - 1 ? point.date.slice(5) : ''))),
        readout,
        h('div', { className: 'dsh-us-legend' },
          layout.legend.map(item => h('span', { key: item.id, className: 'dsh-us-legend-item' },
            h('i', { className: 'dsh-us-swatch', style: { background: item.color } }),
            h('span', { className: 'dsh-us-legend-name', title: item.label }, item.label),
            h('span', { className: 'dsh-us-legend-value' }, compactTokens(item.value)),
            h('span', { className: 'dsh-us-legend-share' }, `${item.share.toFixed(1)}%`)))))
    }

    function Warnings(data) {
      if (data.warnings.length === 0) return null
      return h('div', { className: 'dsh-us-warn', role: 'status' },
        data.warnings.map((warning, index) => h('div', { key: index }, `· ${warning}`)))
    }

    /**
     * Go plan quota: one row with the 5-hour, weekly and monthly windows. This
     * refreshes on its own minute cadence, independent of the token aggregates.
     */
    function QuotaSection(props) {
      const quota = props.quota
      if (quota === undefined) {
        if (props.error === undefined) return null
        return h('div', { className: 'dsh-us-quota' },
          h('div', { className: 'dsh-us-quota-head' },
            h('h3', { className: 'dsh-us-quota-title' }, 'OpenCode Go 额度'),
            h('span', { className: 'dsh-us-quota-note' }, '读取失败')),
          h('div', { className: 'dsh-us-note' }, props.error))
      }
      return h('div', { className: 'dsh-us-quota' },
        h('div', { className: 'dsh-us-quota-head' },
          h('h3', { className: 'dsh-us-quota-title' }, 'OpenCode Go 额度'),
          h('span', { className: 'dsh-us-quota-note' }, `每分钟刷新 · 更新于 ${clockOf(quota.asOf)}`)),
        h('div', { className: 'dsh-us-quota-row' },
          QUOTA_WINDOWS.map(item => {
            const window = quota.windows?.[item.id]
            const percent = quotaPercent(quota, item.id)
            return h('div', { key: item.id, className: 'dsh-us-quota-item' },
              h('div', { className: 'dsh-us-quota-label' },
                h('span', null, item.label),
                h('span', { className: 'dsh-us-quota-value' },
                  window?.status === 'rate-limited' ? '已用尽' : `已用 ${Math.round(percent)}%`)),
              h('div', {
                className: 'dsh-us-quota-track',
                title: `已用 ${Math.round(percent)}%，填充部分为剩余额度`,
              },
                h('div', { className: 'dsh-us-quota-fill', style: { width: `${100 - percent}%` } })),
              h('div', { className: 'dsh-us-quota-reset' }, `重置 ${formatReset(window?.resetsAt)}`))
          })))
    }

    /** The shared dashboard body: summary, daily stacked chart and legend. */
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

      if (snapshot.phase === 'error' && data === undefined) {
        return h(ErrorRow, { message: snapshot.error, onRetry: () => { void controller.refresh() } })
      }
      if (data === undefined) {
        return h(LoadingRow, { elapsed })
      }

      const parts = []
      if (snapshot.error !== undefined) {
        parts.push(h('div', { key: 'err', className: 'dsh-us-error', role: 'alert' }, snapshot.error))
      }
      parts.push(h(SummarySection, { key: 'summary', ...data }))
      parts.push(h(MetaLine, { key: 'meta', ...data }))
      parts.push(h(MetricControls, { key: 'metric', metric: snapshot.metric, onChange: (value) => controller.setMetric(value) }))
      if (data.summary.total === 0) {
        parts.push(h('div', { key: 'empty', className: 'dsh-us-group' },
          h('div', { className: 'dsh-us-empty' }, '最近 30 天没有可统计的 Go 推理记录（request-logs 只保留最近 30 天）。')))
      } else {
        parts.push(h(DailyChart, { key: 'chart', data, metric: snapshot.metric }))
      }
      if (snapshot.refreshing) {
        parts.push(h('div', { key: 'refreshing', className: 'dsh-us-note' }, '正在后台刷新今天的数据…'))
      }
      parts.push(h(Warnings, { key: 'warnings', ...data }))
      parts.push(h(QuotaSection, { key: 'quota', quota: snapshot.quota, error: snapshot.quotaError }))
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
      const quota = snapshot.quota
      const buttonRef = useRef(null)
      const [anchor, setAnchor] = useState(undefined)
      const [hovered, setHovered] = useState(false)

      const showCard = () => {
        const rect = buttonRef.current?.getBoundingClientRect()
        if (rect !== undefined) {
          const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
          setAnchor({ left: Math.round(rect.right + 10), bottom: Math.max(8, Math.round(viewportHeight - rect.bottom)) })
        }
        setHovered(true)
      }
      const hideCard = () => setHovered(false)

      return h('div', {
        className: 'dsh-us-footwrap',
        onMouseEnter: showCard,
        onMouseLeave: hideCard,
        onFocus: showCard,
        onBlur: hideCard,
      },
      h('style', null, CSS),
      h('button', {
        ref: buttonRef,
        type: 'button',
        className: 'dsh-us-footbtn',
        'data-wide': props.wide === false ? 'false' : 'true',
        'aria-label': 'GO 用量',
        'aria-haspopup': 'dialog',
        onClick: () => {
          setHovered(false)
          controller.toggle()
        },
      },
      h(UsageRing, { quota }),
      props.wide === false ? null : h('span', null, 'GO 用量')),
      quota === undefined
        ? null
        : h(QuotaHoverCard, { quota, open: hovered, anchor }))
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
