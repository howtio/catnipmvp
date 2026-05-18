# 07 Runner Progress

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
