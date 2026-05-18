# 03 Worker

消费层，负责从 Queue 拉取任务并驱动执行。

## 目标

把“排好的任务”变成“被实际处理的 run”。

## 职责

- 轮询或监听 Queue
- 控制并发消费
- 驱动 Harness
- 标记任务成功、失败或异常
- 维护 worker heartbeat

## 不负责

- 不构建 prompt
- 不直接执行工具
- 不直接调用模型
- 不承担 Queue 的排队职责

## 当前阶段

线程池、并发位和 worker 心跳后续都归本层，不放到 Queue。
