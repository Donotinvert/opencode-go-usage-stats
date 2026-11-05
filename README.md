# dsh-opencode-go-usage

DSH 插件「用量统计」：在**设置**里新增一页，直接从 **OpenCode Console 官方接口**拉取最近
30 天的**分模型日消耗**（token），覆盖用该 OpenCode Go API Key 的所有客户端流量。

仓库 <https://github.com/Donotinvert/opencode-go-usage-stats>；目录与插件包名均为
`dsh-opencode-go-usage`（profile 挂载标识与客户端 bundle id）。

## 它能看什么

- 最近 30 天汇总：总 token、输入、输出（含 reasoning）、缓存读、请求数。
- 按模型汇总：每个模型的 token 构成、请求数和占比。
- **日 × 模型矩阵**：每天每个模型消耗多少 token，口径可在 总计 / 输入 / 输出 / 缓存读
  之间切换；超过 10 个模型时其余模型合并为「其他」。
- 官方 Go 计费周期（`/activity/go`）的累计 token、请求数和额度消耗（美元）。
- 空值显示 `-`；每天只在 UTC 日界上聚合（与官网图表一致）。

数据来源：`GET https://opencode.ai/console/api/activity/go` 与
`GET /console/api/request-logs/export?since=…&until=…&format=json`（逐日请求日志，
`request-logs` 保留最近 30 天）。Host 侧缓存 10 分钟，「刷新」按钮强制重新拉取。

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

## 卸载

1. 删除 `~/.dsh/profiles/desktop/cordis.patch.yml` 末尾的 `usage-stats` insert 行；
2. 在 profile 目录执行 `pnpm remove dsh-opencode-go-usage`；
3. 硬刷新页面。`D:\code\dsh-plugin\dsh-opencode-go-usage` 源码目录可保留或删除。

## 已验证 / 未验证

- 已验证：Host 半侧 30 天真实数据端到端（`scripts/smoke.mjs`：780.7M tokens / 3,918 次
  请求 / 2 个有消耗的模型，单次拉取 12–27s）；Host 路由 `/usage-stats/api/data` 已注册
  （未认证请求返回本插件的 403 JSON）；Client bundle 已进入模块图并被
  `/plugins/??dsh-opencode-go-usage/client.js&rev=…` 正常返回（200，含「用量统计」与接口路径）。
- 未验证：设置页在浏览器中的实际渲染与交互（当前会话没有已认证页面的截图/浏览器控制
  能力）。硬刷新后请打开 设置 → 用量统计 确认；如有报错把页面文字发回即可排查。

## 开发

- 修改 `client.js` 后，Client HMR 可按 mtime 重载 bundle，硬刷新页面即可；
- 修改 `index.js`（Host 半侧）后需重启 DSH 桌面应用才会加载新代码；
- `node scripts/smoke.mjs` 可单独验证 Host 数据链路。
