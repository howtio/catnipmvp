# 01 Gateway Progress

## 2026-05-18 / Phase 0 / 初始化

### 当前目标

建立 Gateway 层进度文档，并固定其职责边界。

### 本次完成

- 创建本层进度日志文件
- 明确本层后续只负责接单、校验、创建任务、提交 Queue

### 当前状态

- 已完成：进度文档占位
- 进行中：无
- 未完成：代码骨架与实现

### 风险与阻塞

- 当前无代码骨架
- 入口协议和 CLI 参数格式尚未固化

### 下一步

- 在 Phase 1 中补齐 Gateway 层代码骨架

## 2026-05-18 / Phase 0 / 建立空代码骨架

### 当前目标

为 Gateway 层建立最小可编译的 `types.ts`、`wrapper.ts`、`index.ts`。

### 本次完成

- 创建 Gateway 层对外类型
- 创建 Gateway 层 wrapper
- 创建 Gateway 层 index 导出

### 当前状态

- 已完成：空骨架可编译
- 进行中：CLI 输入协议仍为占位
- 未完成：真实参数解析与输入校验

### 风险与阻塞

- 当前 `startCli` 仍使用占位任务输入

### 下一步

- 在 Phase 1 中接入真实 CLI 输入与任务创建逻辑

## 2026-05-18 / Phase 1 / 接入 CLI 输入与任务完成等待

### 当前目标

让 Gateway 从真实 CLI 参数创建任务，并在单次 CLI 运行中感知任务成功或失败。

### 本次完成

- 从 `process.argv` 读取任务输入
- 创建标准 `RunTask` 并提交 Queue
- 等待 Queue 返回任务完成结果
- 在 CLI 侧输出成功或失败结果

### 当前状态

- 已完成：CLI 输入接入、任务创建、完成等待
- 进行中：入口参数协议仍较简单
- 未完成：更完整的参数校验与多命令入口

### 风险与阻塞

- 当前仅支持最小文本输入，不支持结构化命令参数

### 下一步

- 先保持 Gateway 轻量，后续视 CLI 设计再扩展输入协议

## 2026-05-19 / CLI / 增强手测入口与结果回显

### 当前目标

把 Gateway 从“只能一次性读命令行参数”推进到“适合本地连续手测”的 CLI 入口。

### 本次完成

- 新增 `--help` / `-h`
- 新增 `--interactive` / `-i`
- 支持无参数时进入交互输入
- 支持从 stdin 管道读取任务文本
- 抽出统一任务提交逻辑
- 在 CLI 侧输出 `runId`、`steps`、`tool summaries`、`durationMs` 与 `finalAnswer`
- 为 CLI 参数解析补最小测试

### 当前状态

- 已完成：单次执行、交互执行、管道执行三种入口
- 进行中：CLI 仍是轻量文本协议
- 未完成：结构化子命令、会话历史、可配置输出格式

### 风险与阻塞

- 交互模式当前仍依赖单进程常驻 worker，没有显式 shutdown
- `finalAnswer` 可能较长，终端输出暂未做折叠或格式分级

### 下一步

- 继续细化 CLI 输入协议
- 或补会话历史与更明确的交互提示

## 2026-05-19 / CLI / 增补交互会话命令与 EOF 退出修复

### 当前目标

继续强化交互 CLI，让本地连续手测不只“能跑任务”，还具备最小会话控制能力。

### 本次完成

- 新增 `/history`
- 新增 `/last`
- 新增 `/clear`
- 为交互任务结果引入最小结构化结果对象
- 在交互模式内维护本轮会话历史
- 支持重新打印最近一次结果
- 修复管道输入交互模式在 EOF 后抛出 `ERR_USE_AFTER_CLOSE`
- 为交互命令解析补最小测试

### 当前状态

- 已完成：交互模式具备最小会话命令
- 进行中：输出格式仍偏文本直出
- 未完成：结构化子命令、历史持久化、可配置输出模式

### 风险与阻塞

- `/history` 当前只保存当前交互会话，不做落盘
- `finalAnswer` 预览目前只做基础截断，长文本可读性仍一般

### 下一步

- 可继续补输出格式分级
- 或补持久化 session history

## 2026-05-19 / CLI / 增加实时调试输出

### 当前目标

让 CLI 在本地手测时直接打印 prompt、计划、步骤摘要和工具轨迹，便于观察与调试。

### 本次完成

- 新增 `--debug`
- 支持 `CATNIP_CLI_DEBUG=1`
- Gateway 订阅调试事件并实时打印
- 打印 `prompt.composed`
- 打印 `agent.plan.generated`
- 打印 `agent.reasoning.summary`
- 打印 `tool.call.requested / result / failed`
- 打印 `agent.answer.produced`

### 当前状态

- 已完成：CLI 可实时打印公开调试过程
- 进行中：输出仍为直出文本
- 未完成：输出级别切换、摘要/详细模式分层

### 风险与阻塞

- 开启调试后终端输出会明显增多
- 工具结果可能包含较长文本，当前未裁剪

### 下一步

- 可补 `--debug=summary|full` 之类的输出级别
- 或继续优化 trace 日志可读性

## 2026-05-19 / CLI / 实时显示当前运行层

### 当前目标

让 CLI 调试输出不只展示事件内容，还要明确告诉用户当前正在经过哪一层。

### 本次完成

- 为 `run.started` 打印 `04-harness`
- 为 `run.heartbeat` 按 stage 映射到 `05-context`、`06-skills`、`07-runner`
- 为 `prompt.composed` 打印 `04-harness -> 07-runner`
- 为 `tool.call.requested` 打印 `08-eventbus -> 10-executor`
- 为 `tool.call.result / failed` 打印 `10-executor -> 08-eventbus`
- 为 `agent.step.finished` 打印 `07-runner`
- 为 `run.finished` 打印 `04-harness`

### 当前状态

- 已完成：CLI 能实时显示当前运行层
- 进行中：层状态和调试内容仍在同一输出流
- 未完成：分栏显示、输出级别切换

### 风险与阻塞

- 长任务下层状态与调试摘要会混排，输出仍偏密

### 下一步

- 可补简洁模式和完整模式

## 2026-05-19 / CLI / 紧凑时间线与多任务编排

### 当前目标

让 CLI 更像可观察的 coding agent：默认就能看见公开思考、工具读写动作、命令执行与批量任务编排，而不是只在 `--debug` 下直出原始事件。

### 本次完成

- `parseCliArgs` 支持 `--task` / `-t`
- `parseCliArgs` 支持 `--tasks-file`
- 支持从 tasks 文件按行加载任务并忽略 `#` 注释
- 新增默认紧凑时间线输出
- 输出 `[queue]`
- 输出 `[run]`
- 输出 `[stage]`
- 输出 `[context]`
- 输出 `[plan]`
- 输出 `[think]`
- 输出 `[act]`
- 输出 `[done]`
- 输出 `[fail]`
- 输出 `[answer]`
- 输出 `[orchestrator]`
- `--debug` 下保留紧凑时间线并追加原始事件 payload
- 批量任务运行结束后输出成功计数汇总
- 交互模式接入同一套事件打印器

### 当前状态

- 已完成：CLI 默认可见公开思考与工具轨迹
- 已完成：CLI 支持单 worker 下的多任务顺序编排
- 进行中：时间线仍是纯文本流，不是 TUI
- 未完成：输出级别分层、历史持久化、折叠长输出

### 风险与阻塞

- 长任务下 `[think]` 与 `[debug]` 仍可能偏密
- provider tool-calling 模式的 `agent.plan.generated` 目前仍可能先显示空计划，再进入真实工具调用
- 批量任务当前仍是单 worker FIFO，不含并发执行

### 下一步

- 可补 `summary/full` 输出级别
- 或补更强的工具结果裁剪与折叠
- 或继续朝 TUI 风格任务面板推进

## 2026-05-19 / CLI / 调试模式显示 Worker 心跳

### 当前目标

让 CLI 在调试模式下不只看到 run 级阶段，还能看到 worker 池活跃槽位和队列深度，方便手测多任务编排。

### 本次完成

- `--debug` 下打印 `worker.heartbeat`
- 显示 `activeWorkers`
- 显示 `idleWorkers`
- 显示 `queueDepth`
- 保持默认模式不输出 worker 心跳，避免普通交互过密

### 当前状态

- 已完成：调试模式可见 worker 池心跳
- 进行中：worker 心跳仍为原始行式输出
- 未完成：心跳节流、折叠显示、TUI 面板

### 风险与阻塞

- 高并发和短心跳间隔下，`--debug` 输出会更密

### 下一步

- 可补心跳输出级别
- 或补更紧凑的池状态摘要

## 2026-05-19 / CLI / 运行中补充输入转 follow-up

### 当前目标

解决交互模式下“任务运行时无法继续输入微调指令”的问题，让用户在思考和工具执行阶段输入的内容不会丢失。

### 本次完成

- 交互模式从阻塞式 `question()` 改为事件驱动读行
- 运行中收到的新文本会立即被接收
- 运行中收到的新文本会缓存在当前任务的 refinement 列表
- 当前任务结束后自动生成 follow-up 任务
- follow-up prompt 会带上前一轮任务与结果摘要
- `/exit` 在有活跃任务时改为“等待当前任务结束”
- 如果已请求退出，则丢弃未执行的 refinement follow-up
- 新增 follow-up prompt 组装测试

### 当前状态

- 已完成：运行中输入不会丢失
- 已完成：可基于上一轮结果继续微调
- 进行中：follow-up 仍是“下一轮任务”，不是中途打断当前 provider 调用
- 未完成：真正的中断执行、真正的 session memory

### 风险与阻塞

- 当前 refinement 语义是“下一轮续跑”，不是“修改当前正在执行的模型内部状态”
- 如果当前任务超时或失败，follow-up 会基于失败结果和用户 refinement 继续，而不是恢复原调用现场

### 下一步

- 可补更正式的 session history 存储
- 或补显式 `/followup`、`/cancel`、`/interrupt` 命令
- 或继续推进真正的 runner 级中断能力
