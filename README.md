# dsh-opencode-go-usage

DSH 插件「用量统计」：从 **OpenCode Console 官方接口**拉取最近 30 天的**分模型日消耗**
（token），覆盖用该 OpenCode Go API Key 的所有客户端流量。可从左侧栏按钮 / 快捷键直接
打开浮层面板，也可在**设置**里查看完整页面。

仓库 <https://github.com/Donotinvert/opencode-go-usage-stats>；目录与插件包名均为
`dsh-opencode-go-usage`（profile 挂载标识与客户端 bundle id）。

## 快速查看（v0.3.0+）

- **左侧栏底部「用量」按钮**（设置按钮上方）：任意会话一键打开浮层大面板；Esc、点遮罩
  或「关闭」退出。
- **快捷键 `Ctrl+Shift+G`**（macOS 为 `Cmd+Shift+G`）开关面板；可在「设置 → 快捷键」
  里改键或查看冲突。
- 浮层、设置页共用同一份数据与渲染，不会各自重复拉取。
- Host 端按天落盘缓存：`$DSH_HOME/cache/dsh-opencode-go-usage/day-aggregates.v1.json`。
  已完成日期直接复用，只有今天（和昨天收尾）会短 TTL 重拉；插件启动 1.5 秒后开始后台
  预热，之后每 10 分钟刷新今天。因此打开面板通常低于 1 秒。
- 首次安装或缓存为空时仍需拉一次 30 天（约 4–12 秒，取决于网络）。

## 它能看什么

- **日用量堆叠柱状图**：最近 30 天每天一根柱，柱高为该天所选口径（总计 / 输入 / 输出 /
  缓存读）的 token 量。
- 每根柱最多 4 个子项：用量前 3 的模型 + 「其他」（其余模型合计）；Top3 按窗口内总 token
  排名，切换口径时颜色/名次保持稳定。
- 悬停任意一根柱子可看当天合计与各模型明细；图例给出各系列总量与占比。
- 最近 30 天汇总卡：总 token、输入、输出（含 reasoning）、缓存读、请求数。
- 官方 Go 计费周期（`/activity/go`）的累计 token、请求数和额度消耗（美元）。
- 按 UTC 日聚合（与官网图表一致）。

数据来源：`GET https://opencode.ai/console/api/activity/go` 与
`GET /console/api/request-logs/export?since=…&until=…&format=json`（逐日请求日志，
`request-logs` 保留最近 30 天）。导出单页上限 1000 条；触顶的日期会改用列表接口的游标
分页补齐，避免大用量日被少算。Host 端按天缓存，「刷新」只强制补拉今天/昨天；调试可用
`/usage-stats/api/data?days=30&full=1` 全量重拉。

## 认证

Host 半侧按以下顺序解析 OpenCode Go API Key，**Key 不会返回给浏览器**：

1. 环境变量 `DSH_OPENCODE_GO_ACCOUNT_*`（`oc_` 开头）或 `DSH_OPENCODE_GO_API_KEY`；
2. `$DSH_HOME/.credentials.yaml` 中名称含 `OPENCODE…_ACCOUNT_` 的 ref，退而取第一个
   `oc_sk_…`。

没有配置 OpenCode Go 时，页面会显示明确的错误提示。

## 安装（已安装到当前 desktop profile）

本机已经完成安装：profile 依赖 `dsh-opencode-go-usage: link:D:/code/dsh-plugin/dsh-opencode-go-usage`，
并在 `~/.dsh/profiles/desktop/cordis.patch.yml` 末尾插入了挂载行。HMR 已确认插件生效，
硬刷新页面即可看到「设置 → 用量统计」。源码目录为 `D:\code\dsh-plugin\dsh-opencode-go-usage`，
维护约定见同目录的 `AGENTS.md`。

手工安装步骤（换机器或重装时）：

```powershell
# 1) 把本地目录加成 profile 依赖（pnpm 由 DSH 自带运行时提供）
& "D:\program\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\node.exe" `
  "D:\program\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.cjs" `
  add "link:D:\code\dsh-plugin\dsh-opencode-go-usage"

# 2) 在 ~/.dsh/profiles/desktop/cordis.patch.yml 末尾追加挂载行
#    - insert:
#        - id: usage-stats
#          name: 'dsh-opencode-go-usage'

# 3) 硬刷新浏览器页面（Ctrl/Cmd+Shift+R），打开 设置 → 用量统计
```

> 上述两步也可以用 DSH 的 `plugin_manager` 工具 `install_bundle`（目标填本目录绝对路径）
> 自动完成；当前会话没有暴露该工具，因此这里记录手动步骤。

## 限制

- 只统计 **OpenCode Console** 记录的流量；请求日志只有 30 天保留期，早于保留期的日期
  显示 0。
- Go 计划额度按美元计量（不同模型单价不同），本页展示 token 数量，额度消耗单列。
- 页面文案暂为中文（用户环境为中文）；如需英文可后续补 locale 字典。
- 首次安装/缓存为空时第一次打开仍需 4–12 秒；此后由磁盘缓存与后台预热保证秒开。

## 卸载

1. 删除 `~/.dsh/profiles/desktop/cordis.patch.yml` 末尾的 `usage-stats` insert 行；
2. 在 profile 目录执行 `pnpm remove dsh-opencode-go-usage`；
3. 硬刷新页面。`D:\code\dsh-plugin\dsh-opencode-go-usage` 源码目录可保留或删除。
   可选：删除 `$DSH_HOME/cache/dsh-opencode-go-usage/` 缓存目录。

## 已验证 / 未验证

- 已验证：Host 半侧真实 30 天数据端到端（`scripts/smoke.mjs`：约 11.4 亿 tokens / 2 个
  有消耗的模型；首次全量约 4–12 秒，二次读取 0 秒、只命中磁盘缓存）；Host 路由
  `/usage-stats/api/data` 已注册（未认证请求返回本插件的 403 JSON）；客户端渲染用
  `scripts/render-check.mjs` 验证（17 项断言：柱状图、Top3+其他、图例、悬停明细、
  无 `<table>`、100 个柱段）。
- 未验证：浏览器中的实际视觉效果、柱形悬停与点击（当前会话没有已认证页面的截图或浏览器
  控制能力）。重启 DSH 并硬刷新后请实际打开确认；如有报错把页面文字发回即可排查。

## 开发

- 修改 `client.js` 后，Client HMR 可按 mtime 重载 bundle，硬刷新页面即可；
- 修改 `index.js`（Host 半侧）后需重启 DSH 桌面应用才会加载新代码；
- `node scripts/smoke.mjs` 验证 Host 数据链路（真实接口 + 缓存断言）；
- `node scripts/render-check.mjs` 在无浏览器、无独立 React 的环境下用最小 React 替身渲染
  三个入口，检查柱状图结构、图例与无表格；真实视觉效果仍需浏览器确认。
