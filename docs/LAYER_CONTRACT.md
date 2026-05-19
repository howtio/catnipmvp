# Layer Contract

## 11 层调用顺序（含 06.5）

```text
Gateway -> Queue -> Worker -> Harness -> Context -> Skills -> Memory -> Runner -> EventBus -> Tool Registry -> Executor
```

## 分层职责

### Gateway

- 接收用户输入
- 校验输入
- 创建任务并提交 Queue

### Queue

- 入队
- 出队
- 维护任务状态

### Worker

- 消费队列任务
- 驱动 Harness
- 处理成功与失败状态

### Harness

- 管理 run 生命周期
- 调用 Context、Skills、Runner
- 做验收与报告

### Context

- 读取文档
- 汇总 workspace 信息
- 产出系统上下文

### Skills

- 选择技能说明
- 注入 Skill 文本

### Memory

- 读取 session 级短期记忆
- 压缩最近 run 摘要
- 向 Runner 注入 memory context
- 在 run 结束后回写可保留的记忆条目

### Runner

- 驱动模型循环
- 决定是否发起工具调用

### EventBus

- 传递 run、step、tool 事件

### Tool Registry

- 注册工具定义
- 解析工具
- 校验 schema

### Executor

- 监听工具请求
- 执行 guard
- 触发真实副作用

## 每层禁止事项

- Gateway 不直接调用 Runner、Executor、模型、workspace。
- Queue 不理解任务语义。
- Worker 不构建 prompt，不直接执行工具。
- Harness 不直接执行工具。
- Context 不写文件，不执行 shell。
- Skills 不执行文件读写，不执行 shell。
- Memory 不读写 workspace，不执行 shell，不直接调用模型。
- Runner 不直接执行工具，不直接读写文件。
- Tool Registry 不做真实执行。
- Executor 不做推理。

## 跨层 import 规则

- 每层只能通过 `index.ts` 暴露对外能力。
- 跨层只能 import 对方对外入口。
- 不允许跨层 import 对方内部功能文件。
- Runner 不允许 import Executor。
- Runner 不允许 import Tool implementation。
- Runner 不允许自己持久化或拼装 session memory。

## 副作用边界

唯一允许执行真实外部副作用的层是 Executor。

副作用包括：

- 读文件
- 写文件
- patch 文件
- shell 执行
- git 调用

Memory 允许维护进程内受控状态，但不允许越过本地内存边界去读写数据库、向量库、文件或网络存储。

## Runner 与 Executor 隔离规则

- Runner 只能发 `tool.call.requested`
- Executor 监听并执行
- 结果通过 EventBus 回传

## Skills 与 Tools 分离规则

- Skill 是施工说明书
- Tool 是真实执行能力
- Skill 不执行动作
- Tool 不做决策

## Context 与 Memory 分工

- Context 负责静态资料：文档、workspace、system prompt 基础部分
- Memory 负责动态资料：session history、历史回答摘要、可复用偏好和最近执行痕迹
- Runner 只消费两者加工后的输入，不自己维护长期状态
