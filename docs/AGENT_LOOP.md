# Agent Loop

## 目标

定义 Catnip Agent 的最小受控循环，不在本阶段实现。

## 目标流程

```text
1. Gateway 创建任务
2. Queue 入队
3. Worker 消费
4. Harness 创建 run
5. Context 构建上下文
6. Skills 注入施工说明
7. Memory 注入 session/run 记忆
8. Runner 驱动模型循环
9. Runner 通过 EventBus 请求工具
10. Executor 执行工具
11. EventBus 返回工具结果
12. Runner 输出最终回答
13. Memory 回写本次 run 摘要
14. Harness 生成 final report
```

## Runner 约束

- 不直接执行工具
- 不直接读写文件
- 不直接执行 shell
- 只能通过 EventBus 发起工具请求
- 不自己拼接和持久化记忆

## Memory 约束

- 先做 session/run 级短期记忆，不默认做跨进程长期记忆
- 先做受控摘要，不把全部历史原样塞给 Runner
- 记忆写入由 Memory 层统一收口，不让 Gateway 或 Runner 各自缓存一份

## Step 控制

后续至少需要：

- 最大 step 数
- 每 step 的 usage 记录
- tool call 记录
- final answer 归一化

## DeepSeek 预留

后续如果接入 DeepSeek，应该接在 Runner 的 provider adapter 层，不应污染其他层职责。
