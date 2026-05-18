# 08 EventBus

事件层，负责在层与层之间传递运行事件和工具事件。

## 目标

让 Runner、Executor、Logger 在不直接耦合的情况下协作。

## 职责

- 发布 run 事件
- 发布 step 事件
- 发布 tool 事件
- 传播 heartbeat 事件
- 支持等待工具结果

## 不负责

- 不执行工具
- 不做模型推理
- 不存储业务状态

## 当前阶段

MVP 使用 Node.js `EventEmitter` 即可，不引入外部消息系统。
