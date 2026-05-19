# 07 Runner Progress

## 2026-05-19 / Large Step / 统一运行限制与失败恢复

### 当前目标

把 Runner 的步数上限、工具失败处理和重试从分散实现收口成统一策略，并让 provider tool calling 也受同一限制控制。

### 本次完成

- 新增 Runner 统一运行限制配置
- 支持 `maxSteps`
- 支持 `maxToolRetries`
- 支持 `continueOnToolError`
- 在 planned tool calls 路径下强制检查步数预算
- 工具失败时按配置重试或继续
- DeepSeek provider 的 `stopWhen` 改为读取外层 `maxSteps`
- 新增运行限制相关测试

### 当前状态

- 已完成：步数上限、最小失败恢复、最小重试控制
- 进行中：provider tool calling 的中止原因仍较粗
- 未完成：分类重试、动态恢复规划、更细模型兼容验证

### 风险与阻塞

- 真实模型 tool calling 仍可能因为 provider 自身行为导致步数与本地统计存在轻微差异
- 当前失败恢复只适合 MVP，不适合复杂修复型任务

### 下一步

- 继续细化失败分类与恢复策略
- 或补更完整的 provider 级停止原因与运行验收

## 2026-05-18 / Phase 0 / 初始化

### 当前目标

建立 Runner 层进度文档，并记录 DeepSeek 接入方向。

### 本次完成

- 创建本层进度日志文件
- 明确后续模型 provider 以 DeepSeek 为优先方向
- 明确 Runner 只决策，不做副作用

### 当前状态

- 已完成：进度文档占位、DeepSeek 方向记录
- 进行中：无
- 未完成：provider adapter、ReAct Loop、tool call 控制

### 风险与阻塞

- 如果不先抽象 provider adapter，后续 DeepSeek 接入会污染架构
- 模型 step 上限和停止条件尚未确定

### 下一步

- 在 Phase 3 先做 Runner 骨架，再在 Phase 6 接入 DeepSeek

## 2026-05-18 / Phase 0 / 建立空代码骨架

### 当前目标

为 Runner 层建立最小可编译的决策接口和 EventBus 边界。

### 本次完成

- 创建 Runner 层类型定义
- 创建最小 `run` wrapper
- 明确通过 EventBus 发布 step 事件

### 当前状态

- 已完成：Runner 空骨架可编译
- 进行中：仅有单步占位事件
- 未完成：真实 ReAct Loop 与 provider adapter

### 风险与阻塞

- 当前没有真实模型接入，也没有 step 控制策略

### 下一步

- 在 Phase 3 中补齐 Runner 控制流

## 2026-05-18 / Phase 3 / 建立最小工具调用控制流

### 当前目标

让 Runner 从单步占位事件升级为最小工具请求控制流。

### 本次完成

- 从 Tool Registry 选择最小可用工具
- 生成 `tool.call.requested`
- 等待 EventBus 返回工具结果
- 发布 `agent.step.finished` 并带上工具执行结果摘要

### 当前状态

- 已完成：单步工具调用骨架
- 进行中：仍为单次调用
- 未完成：多步 ReAct Loop、停止条件、provider adapter

### 风险与阻塞

- 当前没有模型参与决策，工具选择仍是固定策略

### 下一步

- 在后续阶段继续细化决策循环和模型接入边界

## 2026-05-18 / Post Phase 6 / 增加基础工具路由

### 当前目标

让 Runner 至少能根据任务文本选择不同工具，而不是固定只调 `list_files`。

### 本次完成

- 根据任务文本路由到 `list_files`
- 根据任务文本路由到 `read_file`
- 根据任务文本路由到 `write_file`
- 根据任务文本路由到 `patch_file`
- 根据任务文本路由到 `shell_exec`
- 根据任务文本路由到 `git_diff`

### 当前状态

- 已完成：单步关键词工具路由
- 进行中：仍是规则驱动
- 未完成：多步 ReAct、模型决策、停止条件

### 风险与阻塞

- 当前路由策略对复杂任务仍然不稳定

### 下一步

- 在后续阶段引入更完整的 step 决策与模型接口

## 2026-05-18 / Large Step / 引入 provider adapter 与多步计划

### 当前目标

把 Runner 从单步规则路由升级到可执行多步工具计划的骨架，并为未来模型 provider 固定接口。

### 本次完成

- 新增 `RunnerProvider` 接口
- 新增 heuristic provider
- 支持一次 run 规划多个工具调用
- 记录每一步工具结果摘要
- 生成统一 `finalAnswer`
- 发布 `agent.answer.produced`

### 当前状态

- 已完成：provider adapter 骨架与多步工具计划
- 进行中：provider 仍为本地 heuristic
- 未完成：AI SDK 接口、真实模型决策、step 上限与重试

### 风险与阻塞

- 当前多步计划仍依赖关键词规则

### 下一步

- 在后续阶段接入真实 provider adapter 或完善 step 控制

## 2026-05-18 / Large Step / 接入 AI SDK provider 选择骨架

### 当前目标

让 Runner 的 provider adapter 不再只有 heuristic，本地环境具备切换到 AI SDK provider 的能力。

### 本次完成

- 安装 `ai`
- 安装 `zod`
- 新增 AI SDK provider 实现
- 用 `generateObject` 生成结构化工具计划
- 新增环境驱动的 provider 选择逻辑
- 缺失 key 时自动回退到 heuristic

### 当前状态

- 已完成：AI SDK provider adapter 骨架
- 进行中：默认仍走 heuristic
- 未完成：真实在线调用验证、AI SDK tool calling、模型 step 控制

### 风险与阻塞

- 当前环境没有 AI Gateway key，无法做真实模型验证

### 下一步

- 在有 key 的环境下验证 AI SDK 计划输出
- 或继续把 Runner 接到更完整的模型循环

## 2026-05-18 / Large Step / 接入本地 DeepSeek provider

### 当前目标

让 Runner 能在本地 secrets 存在时直接使用 DeepSeek provider，而不是只支持 AI Gateway 或 heuristic。

### 本次完成

- 新增 `createDeepSeekRunnerProvider`
- 新增 `.local-secrets/*.env` 自动加载
- 新增 `deepseek` provider 选择模式
- 在真实本地运行中验证 DeepSeek 计划输出

### 当前状态

- 已完成：本地 DeepSeek 直连计划生成
- 进行中：仍使用结构化计划生成
- 未完成：AI SDK tool calling、在线失败恢复、step 上限

### 风险与阻塞

- 当前本地 secrets 依赖开发机文件约定

### 下一步

- 继续把真实模型接到更完整的工具循环

## 2026-05-19 / Large Step / 接通 AI SDK tool calling

### 当前目标

让 DeepSeek provider 不只是返回工具计划，而是在 Runner 内直接通过 AI SDK tools 驱动工具调用循环。

### 本次完成

- 为 provider 增加 `runWithTools`
- 使用 `generateText`
- 使用 `tools`
- 使用 `stopWhen: stepCountIs(5)`
- 通过 Runner 的 `executeToolCall` 间接调用 EventBus / Executor

### 当前状态

- 已完成：真实模型 tool calling 基础链路
- 进行中：step 控制仍较粗
- 未完成：统一超时、失败恢复、更多模型兼容验证

### 风险与阻塞

- 在线模型在复杂任务下可能耗时较长

### 下一步

- 在后续阶段补 step 上限、超时和失败恢复策略

## 2026-05-19 / Debug / 发布计划与步骤摘要事件

### 当前目标

让 Runner 在调试模式下能公开输出“计划什么、为什么调工具、每一步模型公开文本说了什么”。

### 本次完成

- 新增 `agent.plan.generated`
- 新增 `agent.reasoning.summary`
- 计划模式下发布 planned tool calls
- provider tool calling 模式下发布 provider-managed plan 事件
- 工具执行前发布基于 `reason` 的步骤摘要
- provider `onStepFinish` 后发布公开文本摘要

### 当前状态

- 已完成：Runner 关键决策过程可观测
- 进行中：摘要内容仍依赖模型公开输出质量
- 未完成：step 限制、超时、失败恢复

### 风险与阻塞

- 调试摘要不是隐藏推理链，只是公开步骤说明
- 某些任务下摘要文本可能很长

### 下一步

- 继续补 step/timeout/recovery 主线
- 或给摘要输出增加裁剪和级别控制

## 2026-05-19 / Debug / 扩展 step finished 可观测性

### 当前目标

让调试模式不仅能看见步骤摘要，还能看见每一步完成时 Runner 记录的 usage 结构。

### 本次完成

- CLI 订阅 `agent.step.finished`
- 打印 `stepNumber`
- 打印 `usage`
- 与 `agent.reasoning.summary` 组合展示

### 当前状态

- 已完成：Runner 步骤前后都可观测
- 进行中：usage 仍是原始对象直出
- 未完成：usage 结构裁剪和分级

### 风险与阻塞

- usage 在复杂任务下可能较长

### 下一步

- 可继续做 summary/full 输出级别
