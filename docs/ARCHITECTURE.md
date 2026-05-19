# Catnip Agent MVP Architecture

## 项目目标

Catnip Agent 是一个本地运行的最小可控 Coding Agent Runtime。

当前阶段只建设骨架，不实现真实工具执行，不接入真实模型调用。

## 11 层架构（含 06.5）

调用顺序固定为：

```text
Gateway -> Queue -> Worker -> Harness -> Context -> Skills -> Memory -> Runner -> EventBus -> Tool Registry -> Executor
```

各层职责摘要：

1. Gateway：接收输入并创建任务。
2. Queue：以内存 FIFO 管理任务状态。
3. Worker：消费任务并驱动 Harness。
4. Harness：管理单次 run 生命周期。
5. Context：准备文档、workspace 摘要和系统上下文。
6. Skills：注入施工方法说明，不执行动作。
6.5. Memory：管理 session/run 级记忆的提取、压缩和回写。
7. Runner：负责模型决策和受控循环。
8. EventBus：传递 run 与 tool 事件。
9. Tool Registry：定义和注册工具。
10. Executor：唯一副作用边界。

## 当前范围

当前仅完成：

- 目录结构
- 分层文档
- skills 文档
- 施工计划
- 施工日志
- 实时开发进度日志

当前不完成：

- AI SDK 接入
- DeepSeek 接入
- 真实工具执行
- 测试实现
- CLI 参数解析实现

## 后续模型策略

后续模型接入目标以 DeepSeek 为主，但不在本阶段落地。

预留原则：

- Runner 层负责模型决策接口。
- Harness 层不依赖具体模型供应商。
- Context、Skills 与 Memory 共同产出模型无关输入。
- 后续可以将 DeepSeek 作为默认 provider 接入 Runner。
