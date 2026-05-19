# 10 Executor Progress

## 2026-05-18 / Phase 0 / 初始化

### 当前目标

建立 Executor 层进度文档，并固定副作用边界。

### 本次完成

- 创建本层进度日志文件
- 明确本层是唯一副作用边界

### 当前状态

- 已完成：进度文档占位
- 进行中：无
- 未完成：tool 执行、guard、审计日志

### 风险与阻塞

- 如果其他层提前产生副作用，会破坏整体架构
- guard 执行顺序和错误格式尚未统一

### 下一步

- 在 Phase 4 中实现 Executor 骨架

## 2026-05-18 / Phase 0 / 建立空代码骨架

### 当前目标

为 Executor 层建立最小可编译的启动接口与依赖边界。

### 本次完成

- 创建 Executor 层类型定义
- 创建最小 start wrapper
- 创建 index 导出

### 当前状态

- 已完成：空骨架可编译
- 进行中：仅有启动占位事件
- 未完成：guard、工具执行、审计日志

### 风险与阻塞

- 当前没有真实副作用执行能力

### 下一步

- 在 Phase 4 中补齐 guard 与执行骨架

## 2026-05-18 / Phase 3 / 建立最小工具请求监听骨架

### 当前目标

让 Executor 能消费 Runner 通过 EventBus 发出的工具请求事件。

### 本次完成

- 监听 `tool.call.requested`
- 按工具名从 Tool Registry 解析工具
- 对未知工具返回 `tool.call.failed`
- 对已知工具返回模拟 `tool.call.result`

### 当前状态

- 已完成：最小事件消费与返回骨架
- 进行中：仅返回模拟结果
- 未完成：真实 guard、审计日志、真实副作用执行

### 风险与阻塞

- 当前没有路径、命令、权限 guard

### 下一步

- 在 Phase 4 中补齐 guard 结构和更完整的执行边界

## 2026-05-18 / Phase 4 / 建立执行前 guard 准入骨架

### 当前目标

让 Executor 在返回工具结果前，先统一经过最小准入检查。

### 本次完成

- 新增 `guardToolCall`
- 校验工具是否已注册
- 校验权限是否与工具定义匹配
- 校验参数是否为对象
- 校验 `workspaceRoot` 是否与当前 workspace 一致

### 当前状态

- 已完成：最小准入检查骨架
- 进行中：仅支持结构级校验
- 未完成：pathGuard、commandGuard、真实执行与审计日志

### 风险与阻塞

- 当前 guard 尚未覆盖路径遍历、命令白名单和超时

### 下一步

- 在 Phase 5 中继续把 guard 细化到真实工具最小可用水平

## 2026-05-18 / Phase 5 / 落地最小只读执行能力

### 当前目标

让 Executor 真正执行第一批低风险工具，并保持副作用边界集中在本层。

### 本次完成

- 实现 `list_files`
- 实现 `read_file`
- 实现 `git_diff`
- 在 guard 中增加基础路径边界检查

### 当前状态

- 已完成：第一批只读工具执行
- 进行中：guard 仅覆盖基础路径检查
- 未完成：写入类工具、commandGuard、审计日志

### 风险与阻塞

- 当前仍缺少 shell 命令白名单和写入类路径保护

### 下一步

- 在后续阶段继续补写入类工具和更细的 guard 规则

## 2026-05-18 / Post Phase 6 / 补齐写入类工具与 shell 白名单

### 当前目标

把剩余最小工具执行补齐，并让 guard 覆盖基础 shell 白名单检查。

### 本次完成

- 实现 `write_file`
- 实现 `patch_file`
- 实现 `shell_exec`
- 为 `shell_exec` 增加白名单命令校验
- 为写入类工具增加路径边界检查

### 当前状态

- 已完成：最小工具集全部可执行
- 进行中：guard 仍是最小规则集
- 未完成：通用 patch 语法、命令超时、审计细节

### 风险与阻塞

- `shell_exec` 目前严格限制在白名单，灵活性有限

### 下一步

- 在后续阶段继续强化 commandGuard 与执行审计

## 2026-05-19 / Executor / 增加受限浏览器预览执行

### 当前目标

让工具链至少能在写完 html 后打开浏览器预览，同时不放开任意 shell。

### 本次完成

- 新增 `open_browser` 执行能力
- 按平台选择默认打开命令：Linux `xdg-open`、macOS `open`、Windows `cmd /c start`
- 支持 `CATNIP_BROWSER_OPEN_BIN` 覆盖打开命令，便于测试
- guard 限制 `open_browser` 仅允许 `.html/.htm`
- guard 限制 `open_browser` 仅允许 `workspaces/demo/`
- 新增 guard 测试与工具执行测试

### 当前状态

- 已完成：最小 html 浏览器预览闭环
- 进行中：仍是单文件预览，不负责起 HTTP 服务
- 未完成：dev server 生命周期、浏览器关闭/复用、打开结果回执细化

### 风险与阻塞

- 默认依赖本机存在 `xdg-open` 或对应平台打开命令
- 当前只验证“命令已发起”，不验证浏览器页面是否实际渲染成功

### 下一步

- 可继续补静态服务器工具
- 或补 headless 浏览器验收

## 2026-05-19 / Executor / 增加受限网页搜索执行

### 当前目标

让工具层具备最小外部搜索能力，同时保留受限浏览器搜索入口，不放开任意 URL 或任意网络命令。

### 本次完成

- 新增 `web_search` 执行能力
- `web_search` 通过 DuckDuckGo HTML 发起搜索
- `web_search` 返回 `query / engine / results`
- 新增 `open_browser_search` 执行能力
- `open_browser_search` 只生成搜索 URL 并调用默认浏览器打开
- guard 为 `web_search` 增加 `query` 与 `limit` 校验
- guard 为 `open_browser_search` 增加查询词校验
- 新增对应 guard 与执行测试

### 当前状态

- 已完成：最小网页搜索与浏览器搜索闭环
- 进行中：搜索结果字段仍较精简
- 未完成：多搜索引擎、超时/重试、结果去重

### 风险与阻塞

- `web_search` 依赖外部搜索页面结构，后续可能需要适配
- 当前没有单独的网络超时配置

### 下一步

- 可继续补网络超时与失败分类
- 或补结果摘要与来源字段
