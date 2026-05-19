# 03 Worker Progress

## 2026-05-18 / Phase 0 / 初始化

### 当前目标

建立 Worker 层进度文档，并固定并发、线程池、心跳归属。

### 本次完成

- 创建本层进度日志文件
- 明确并发控制和线程池归属 Worker
- 明确 worker heartbeat 归属 Worker

### 当前状态

- 已完成：进度文档占位、职责确认
- 进行中：无
- 未完成：worker loop、并发位、心跳机制

### 风险与阻塞

- 如果心跳散落到其他层，后续调试会变乱
- 并发模型还未选定为单线程调度还是工作池封装

### 下一步

- 在 Phase 1 中实现 worker loop 和 heartbeat 骨架

## 2026-05-18 / Phase 0 / 建立空代码骨架

### 当前目标

为 Worker 层建立最小可编译的启动接口和依赖边界。

### 本次完成

- 创建 Worker 层类型定义
- 创建 Worker 层 wrapper
- 创建 index 导出

### 当前状态

- 已完成：空骨架可编译
- 进行中：仅有启动占位
- 未完成：真实 worker loop、并发位、heartbeat

### 风险与阻塞

- 当前 `start()` 尚未实际消费任务

### 下一步

- 在 Phase 1 中实现真实任务消费循环

## 2026-05-18 / Phase 1 / 实现单 Worker 通知式消费

### 当前目标

让 Worker 真正从 Queue 消费任务，并驱动 Harness 完成最小 run 流转。

### 本次完成

- 启动单 Worker 消费循环
- 使用 Queue 通知接口等待新任务
- 在消费前后标记 `running / done / failed`
- 发布最小 worker heartbeat

### 当前状态

- 已完成：单 Worker 消费链路
- 进行中：heartbeat 仍是最小事件输出
- 未完成：关闭机制、并发配置、超时治理

### 风险与阻塞

- 当前未实现显式 shutdown，后续测试和长跑场景需要补齐

### 下一步

- 在后续 Phase 中补 worker 生命周期控制与更细粒度观测

## 2026-05-19 / CLI / 回写运行结果供 Gateway 展示

### 当前目标

让 Worker 在任务完成后把 Harness 的运行摘要透传回 Queue，使 CLI 能直接显示结果。

### 本次完成

- 将 `harness.runTask` 的依赖返回类型收紧为 `RunFinalReport`
- 在任务成功完成时回写 `runId`
- 在任务成功完成时回写 `finalAnswer`
- 在任务成功完成时回写 `stepsUsed`
- 在任务成功完成时回写 `toolSummaryCount`

### 当前状态

- 已完成：任务状态可携带最小运行摘要
- 进行中：失败分类仍较粗
- 未完成：更细运行指标、显式 shutdown、并发治理

### 风险与阻塞

- 当前任务对象承载了部分展示字段，后续若扩展更多结果结构，可能需要独立 result object

### 下一步

- 继续补 Worker 生命周期管理
- 或在 Queue / Harness 间抽独立任务结果结构

## 2026-05-19 / Worker / 线程池式消费与增强心跳

### 当前目标

把 Worker 从单循环消费提升为可配置并发消费，并让 heartbeat 能反映线程池状态，而不只是最小 `busy` 标志。

### 本次完成

- 为 Worker 增加 `workerCount` 配置
- 为 Worker 增加 `heartbeatIntervalMs` 配置
- 启动时按 `workerCount` 拉起多个消费槽
- 保持 Queue 只负责 FIFO，不把线程池逻辑放进 Queue
- heartbeat 增加 `activeWorkers`
- heartbeat 增加 `idleWorkers`
- heartbeat 增加 `queueDepth`
- heartbeat 增加 `completedTasks`
- heartbeat 增加 `failedTasks`
- `bootstrap` 支持从环境变量注入 Worker 配置
- trace 日志接入 `worker.heartbeat`
- 新增 Worker 并发消费测试
- 新增 Worker 心跳观测测试

### 当前状态

- 已完成：Worker 并发消费骨架
- 已完成：Worker 聚合心跳观测
- 进行中：仍是单进程内并发槽位，不是真操作系统线程
- 未完成：显式 shutdown、任务取消、worker 池动态缩放

### 风险与阻塞

- 当前“线程池”本质上是 Node 进程内多个异步消费槽，不是多进程或 `worker_threads`
- 长时间运行下仍缺少优雅关闭机制
- 心跳当前是聚合视角，还没做到每个槽位单独追踪

### 下一步

- 可补 shutdown 与测试清理机制
- 或补每个消费槽位的独立标识和更细粒度日志
- 或继续补 queue backlog / starvation 观测

## 2026-05-19 / Worker / 透传超时失败分类

### 当前目标

让 Gateway 能分辨普通运行错误和超时错误，不再把所有失败都折叠成一类。

### 本次完成

- Worker 捕获 `TimeoutError`
- 失败任务状态增加 `failureKind=timeout`
- 非超时错误归类为 `failureKind=runtime`
- 新增 Worker 失败分类测试

### 当前状态

- 已完成：失败分类最小透传
- 进行中：分类仍只有 timeout/runtime 两类
- 未完成：更细 tool/provider/guard 失败分类

### 风险与阻塞

- 当前失败分类来自 Worker catch 分支，后续若要更细需要 Harness/Runner/Executor 共同补字段

### 下一步

- 可继续补更细失败 taxonomy
