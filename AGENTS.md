# AGENTS.md — dsh-opencode-go-usage

DSH 本地插件「用量统计」：设置页展示 OpenCode Go 最近 30 天的分模型日消耗。
目录 `dsh-opencode-go-usage`，GitHub 仓库 <https://github.com/Donotinvert/opencode-go-usage-stats>；
插件包名与客户端 bundle id 仍是 `dsh-usage-stats`（profile 挂载标识，改名会破坏现有安装）。
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

### DSH 插件契约（0.2.1-rc.5，从 app.asar 与已装插件反推）

- 客户端 bundle 是**普通脚本**，必须是 `window.__ModuleLoader__.load({ id: <包名>, factory(require){ return { inject, apply } } })`；只能 `require('react')` 等平台模块表内容，**不要 require ui-primitives**。
- manifest：`dsh.bundle.patch` 指向 `cordis.patch.yml`；`dsh.client = { platform:'web', immediately:true, inject:[已挂载的客户端包，如 @deepseek-ai/dsh-client-ui-settings] }`；`exports['./client']` 即 bundle。
- Host：`inject=['webServer','connection']`；路由用 `ctx.effect(() => ctx.webServer.register({kind:'prefix',path,handler}))`；准入用 `ctx.connection.requestRejection(req)`。
- 设置页：`ctx.slots.inject('settings.section', () => ctx.slots.register({name:'settings.section', id, order, label}, Component))`；slot 类型由 `@deepseek-ai/dsh-client-ui-settings` 声明；样式只用 `--dsw-alias-*` token。
- Client 请求 Host：`new URL('usage-stats/api/data', document.baseURI)`。桌面 shell 把 `dsh-app://app/` 的非静态路径同源转发给 Host；写死 `/usage-stats/...` 会绕过反向代理前缀。
- 生效规则：profile 依赖/挂载行变化 → HMR 重新组合；`client.js` 按 mtime 重载（硬刷新）；`index.js` 改动必须重启桌面应用。
- `dsh` CLI 拒绝操作 desktop profile（"managed exclusively by the Electron application"），`--dump-config` 不可用。安装/重装只能使用桌面自带的 node+pnpm：
  `<安装目录>\resources\runtime\primary-runtime\dependencies\{node\bin\node.exe,pnpm\bin\pnpm.cjs}`，在 profile 目录执行 `add "link:<绝对路径>"`。
- profile 的 `node_modules/dsh-usage-stats` 是符号链接。**移动插件目录后必须重新 `pnpm add link:<新路径>`**，否则 Host 仍加载旧路径。

## 二、简单但关键（做错会直接破坏现状）

- API Key 只允许 Host 侧读取；禁止写入源码、日志、页面响应或提交记录。
- 只改本目录与 profile 中本插件相关行（依赖、`pnpm-lock.yaml`、`cordis.patch.yml` 的 `usage-stats` insert）；其它行不动。
- 本目录是**独立 git 仓库**（remote: `https://github.com/Donotinvert/opencode-go-usage-stats.git`），
  已通过 `D:\code\.git\info\exclude` 对 `code` 仓库隐藏（本地生效，不随仓库同步）；不要在 `code`
  仓库提交本目录，也不要删除这条排除规则（否则 `code` 的 `git status` 会把整个插件目录当未跟踪内容）。
- 推送本仓库只提交本目录内容；profile 与 `~/.dsh` 下的配置不在本仓库内。
- 验证分三层，不得用前两层推断第三层：
  1. `node --check index.js`、`node --check client.js`、`node scripts/smoke.mjs`（真实接口）；
  2. Host：`curl -s $DSH_WEB_URL/usage-stats/api/data` 应返回本插件 403 JSON（404=路由未注册；401=认证层，不代表故障）；
  3. Client：`curl -sN --max-time 8 $DSH_WEB_URL/plugins/events` 应含 `"id":"dsh-usage-stats"` 的 entry（带 rev），请求其 `plugins/??…` 应 200 且含「用量统计」。
- 页面真实渲染只能由用户在浏览器确认；汇报完成度时写清停在哪一层。
- 改数据口径/接口/窗口时，同步更新 `index.js` 注释、`README.md` 与本文件第一节。
