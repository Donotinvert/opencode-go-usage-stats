# AGENTS.md — dsh-opencode-go-usage

DSH 本地插件「用量统计」：设置页展示 OpenCode Go 最近 30 天的分模型日消耗。
目录 `dsh-opencode-go-usage`，GitHub 仓库 <https://github.com/Donotinvert/opencode-go-usage-stats>；
插件包名与客户端 bundle id 均为 `dsh-opencode-go-usage`（profile 挂载标识；改名需同步 profile 挂载行并重启 DSH）。
本文件只记录两类信息：**花大量 token/排障才得到的结论**，以及**简单但做错就会破坏现状的关键点**。
文件职责与用户安装说明见 `README.md`；不要再往这里添加流程性、常识性或可从代码直接看出的内容。

## 一、代价高、难以重新推导的事实

### Console 官方接口（本机实测）

- 认证：`Authorization: Bearer oc_sk_…`。Go API Key 可直接访问 Console API，不需要浏览器会话 cookie。
- Key 位置：`$DSH_HOME/.credentials.yaml` 的 `refs[DSH_OPENCODE_GO_ACCOUNT_<HEX>]`；Host 进程通常没有对应环境变量，必须读文件。
- `GET /console/api/activity/go` → Go 计费周期：`startsAt`、`daily[{date,totalTokens,totalRequests,totalCostMicroCents}]`、`models[{model,totalRequests}]`；`totalCostMicroCents` 是额度消耗，1e8 = $1。
- `GET /console/api/activity/usage?view=workspace|personal` 只含 Go 计划外/余额消费，计划内 token 全为 0，**不能**用于本插件。
- `GET /console/api/request-logs/export?format=json&since=<epoch ms>&until=<epoch ms>` → 逐请求明细，单页 **1000 条**，超出 `truncated=true`；`limit` 上限 100，与 export 同用会 400。
- 逐请求字段：`startedAt`、`model`/`requestedModel`、`provider`、`inputTokens`、`outputTokens`、`reasoningTokens`、`cacheReadTokens`、`cacheWriteTokens`。reasoning 是 output 的子集，input 不含缓存。
- 请求日志只保留 **30 天**（`retentionDays=30`），更早日期返回空 → 页面窗口上限 30 天。不要用 `day=` 参数分日（时区语义不明），用 since/until 毫秒窗口 + UTC 日聚合。
- 本机网络偶发 `SSL: UNEXPECTED_EOF`：单日请求必须重试（当前 3 次、400ms 递增），否则缺一天会污染统计。
- 无 `model` 字段的非推理请求必须跳过，不能计入请求数。
- 额度（5 小时/每周/每月）：`GET https://opencode.ai/zen/go/v1/usage`（同一个 Go Key，Bearer）→ `{"usage":{"rolling":{"status","percent","resetsAt"},"weekly":…,"monthly":…}}`。`percent` 是**已用百分比**（0–100），`status` 为 `ok`/`rate-limited`，`resetsAt` 为 ISO 时间。注意 `/zen/go/usage`（无 `/v1`）返回 404 HTML，必须带 `/v1`。缺字段或格式不符要整体报错，不能当成 0%（会被读成"没用量"）。Host 缓存 60 秒，客户端每分钟轮询 `/usage-stats/api/quota`，与 30 天 token 缓存相互独立。

### DSH 插件契约（0.2.2-rc.1，从 app.asar 与已装插件反推）

- 客户端 bundle 是**普通脚本**，必须是 `window.__ModuleLoader__.load({ id: <包名>, factory(require){ return { inject, apply } } })`；只能 `require('react')` 等平台模块表内容，**不要 require ui-primitives**。
- manifest：`dsh.bundle.patch` 指向 `cordis.patch.yml`；`dsh.client = { platform:'web', immediately:true, inject:[已挂载的客户端包，如 @deepseek-ai/dsh-client-ui-settings] }`；`exports['./client']` 即 bundle。
- Host：`inject=['webServer','connection']`；路由用 `ctx.effect(() => ctx.webServer.register({kind:'prefix',path,handler}))`；准入用 `ctx.connection.requestRejection(req)`。
- 设置页：`ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id, order, label}, Component))`；slot 类型由 `@deepseek-ai/dsh-client-ui-settings` 声明；样式只用 `--dsw-alias-*` token。
- 快捷入口的两个 slot（0.2.2 实测）：`sidebar.footer.action`（侧栏底部、设置按钮上方，props 为 `{ wide }`，窄侧栏需只画图标）；`shell.overlay`（root 级 list slot，props `{}`，适合自绘 fixed 浮层；Esc/遮罩自行处理，不要往 document.body 追加节点）。
- 快捷键：`ctx.shortcuts.register({ id, label: () => 文案, aliases, defaults: { 'desktop:windows': { code:'KeyG', modifiers:['primary','shift'] }, … }, regions:['page','editable'], modals:[], resolve:()=>({status:'handled', run}) })`；需在 `ctx.effect` 内注册，且与已有默认键冲突会抛错——必须 `try/catch` 兜底，不能让它带崩整个插件。`ctx.inject(['shortcuts'], cb)` 可做可选注入。
- Client 请求 Host：`new URL('usage-stats/api/data', document.baseURI)`。桌面 shell 把 `dsh-app://app/` 的非静态路径同源转发给 Host；写死 `/usage-stats/...` 会绕过反向代理前缀。
- 生效规则：profile 依赖/挂载行变化 → HMR 重新组合；`client.js` 按 mtime 重载（硬刷新）；`index.js` 改动必须重启桌面应用。
- `dsh` CLI 拒绝操作 desktop profile（"managed exclusively by the Electron application"），`--dump-config` 不可用。安装/重装只能使用桌面自带的 node+pnpm：
  `<安装目录>\resources\runtime\primary-runtime\dependencies\{node\bin\node.exe,pnpm\bin\pnpm.cjs}`，在 profile 目录执行 `add "link:<绝对路径>"`。
- profile 的 `node_modules/dsh-opencode-go-usage` 是符号链接。**移动插件目录后必须重新 `pnpm add link:<新路径>`**，否则 Host 仍加载旧路径。

### 展示结构（0.6.0 起）

- 顶部两个并排汇总块（`SummarySection`）：左「最近 N 天累计」用 `summary` 显示总 token、请求数、模型数与输入/输出/缓存读；右「今日（UTC）」取 `daily` 中当天的 `totals`，显示今日总 token、分项、占累计比例和「较前 N 天日均 ±X%」。`daily` 行只有 `totals` 与 `byModel`，**没有每日请求数**；要展示今日请求数必须改 Host 的 `mergeDayAggregates`。
- 「日用量堆叠柱状图」：每天一根柱，Top3 模型 + 「其他」最多 4 个系列；Top3 按窗口 `totalTokens` 排名，跨口径稳定；「其他」聚合第 4 名之后的全部模型。
- 柱高按所选口径（`total/input/output/cacheRead`）与窗口内单日最大值 ×1.08 归一化（留出顶部余量，柱形与参考线共用同一比例尺）；虚线为「过去 N 天日均」（排除今天），今天柱形加品牌色描边、日期标签高亮；悬停显示当天合计、较日均幅度与各系列明细；图例显示各系列总量与占比；空值日画 2px 基线。
- 底部额度区 `QuotaSection`：一行三条进度条（5 小时/每周/每月），显示已用百分比、进度和重置时间，标题右侧标「每分钟刷新 · 更新于 HH:mm」。**进度条为「白色 1px 描边 + 透明底」，白色填充片代表剩余额度，空白代表已用**（用户指定语义）；填充宽度 = `100 − percent`，整条 `title` 提示「已用 X%，白色填充为剩余额度」。不要用 brand-primary 当填充色（本主题渲染成白色，无法与空白区分）。数据来自独立的 `snapshot.quota`，由每分钟轮询填充；失败时显示错误文案，不回落成 0%。
- 侧栏图标 `UsageRing`：两个半环（上半环 5 小时、下半环本月），用 `pathLength=100` + `strokeDasharray="<剩余%> 100"` 画**剩余额度**（与额度条「白色=剩余」语义一致，低用量时接近满环）；两段弧各留约 18° 缺口以免上下粘连；**弧线颜色必须用 `SERIES_COLORS[0]`（与柱状图第一系列同色）**，不要用 `currentColor`（会变成灰色，与打开后的图表不一致）；悬停信息改由 `QuotaHoverCard` 展示，不再使用 `title` 文本。
- 侧栏按钮悬停：右侧弹出极简额度卡 `QuotaHoverCard`（min-width 168px，**不画条形图**）：仅三行 `5 小时 / 每周 / 每月` + `剩 X%`（剩余 = 100 − 已用%），无标题、无分隔线、无操作按钮；点击图标本身打开浮层。不要恢复 `title` 文本 tooltip；卡片用 fixed 定位在按钮右侧（`left = rect.right + 10`，`bottom` 对齐按钮底），以 `data-open` 控制显隐，便于静态渲染断言。
- 组件结构：`DailyChart`（纯数据 → 柱/轴/明细/图例）+ `UsageBody`（汇总块/口径/图表/告警/额度）+ `QuotaHoverCard`（侧栏悬停卡）；`data.models` 字段是 `totalTokens/...`，`row.byModel` 桶字段是 `total/input/output/cacheRead`，两个访问器 `metricOfModel` 与 `metricOf` 不可混用。数据来源脚注已删除，口径说明改在分项 `title` 提示里。
- 渲染验证：`node scripts/render-check.mjs`。本机没有可被 Node import 的独立 React（客户端 bundle 从模块表取 React），脚本内自带最小 React 替身（createElement + 4 个 hook）再序列化元素树；断言不得含 `<table>`、必须有两个汇总块与 `dsh-us-avg`、必须有 `dsh-us-seg` 与 Top3+其他、必须有额度三进度条与侧栏四条 `<path>` 半环。fixture 窗口以运行当天 UTC 结尾，日期断言不写死。
- README 的截图位于 `docs/screenshots/`（`panel.png` 浮层面板、`quota.png` 额度区）；入口、配色或布局变化后同步替换截图，并在 README 保持「功能 / 数据来源与隐私 / 与其它插件配合 / 安装 / 注意事项 / 开发测试」结构。

### 加载性能与缓存（0.3.0 起，勿破坏）

- 冷读 30 天 = 30 次 export（4–12 秒），因此 Host 按天落盘缓存到 `$DSH_HOME/cache/dsh-opencode-go-usage/day-aggregates.v1.json`（存日聚合，不存原始记录，约几十 KB）。
- 已完成日期视为不可变永久复用；今天 TTL 10 分钟、昨天 2 小时；`truncated` 日 TTL ×3（补齐成本高）。打开面板应命中缓存（<1 秒）。
- 插件启动 1.5 秒后后台预热 30 天，之后每 10 分钟刷新一次今天；这样首屏不依赖用户点击。
- 路由参数语义：默认只补缺失/过期日；`force=1` 只强制今昨；`full=1` 全量重拉（调试用）。刷新按钮用 `force=1`。
- export 单页 1000 条且**不返回游标**；超过 1000 条的日期必须改用 `GET /console/api/request-logs?since&until&limit=100&cursor=<原始 JSON 字符串>` 逐页补齐。cursor 是 JSON **字符串**，二次编码会 400。
- 客户端不要把 30 天数据折叠逻辑复制到 UI：Host 返回 `summary/models/daily(byModel)`，客户端只渲染；三个入口（设置页、侧栏按钮、浮层）共用一个 controller，避免各拉一份。

## 二、简单但关键（做错会直接破坏现状）

- API Key 只允许 Host 侧读取；禁止写入源码、日志、页面响应或提交记录。
- 只改本目录与 profile 中本插件相关行（依赖、`pnpm-lock.yaml`、`cordis.patch.yml` 的 `usage-stats` insert）；其它行不动。
- 本目录是**独立 git 仓库**（remote: `https://github.com/Donotinvert/opencode-go-usage-stats.git`），
  如它被放在另一个工作区目录下，可用该工作区的本地 `.git/info/exclude` 把本目录排除
  （排除只在本机生效，不随仓库同步）；不要在父级工作区仓库提交本目录。
- 推送本仓库只提交本目录内容；profile 与 `~/.dsh` 下的配置不在本仓库内。
- 验证分三层，不得用前两层推断第三层：
  1. `node --check index.js`、`node --check client.js`、`node scripts/smoke.mjs`（真实接口）；
  2. Host：`curl -s $DSH_WEB_URL/usage-stats/api/data` 应返回本插件 403 JSON（404=路由未注册；401=认证层，不代表故障）；
  3. Client：`curl -sN --max-time 8 $DSH_WEB_URL/plugins/events` 应含 `"id":"dsh-opencode-go-usage"` 的 entry（带 rev），请求其 `plugins/??…` 应 200 且含「用量统计」；bundle 还应含 `sidebar.footer.action` 与 `Ctrl+Shift+G` 文案（侧栏按钮与快捷键已注册）。
- 数据链路自测：`node scripts/smoke.mjs` 会在真实拉取后再跑一次 collect，断言二次读取命中磁盘缓存（fetchedDays ≤ 2 且总量一致）。
- 页面真实渲染只能由用户在浏览器确认；汇报完成度时写清停在哪一层。
- 改数据口径/接口/窗口时，同步更新 `index.js` 注释、`README.md` 与本文件第一节。
