# Catnip Agent Construction Plan

## 当前目标

Phase 0 先搭建目录和文档骨架，确保后续实现有明确边界和施工顺序。

## 非目标

- 不写 TypeScript 实现代码
- 不创建可运行 CLI
- 不接入 AI SDK
- 不接入 DeepSeek
- 不实现真实 Tool
- 不写测试逻辑

## Phase 0：项目骨架

目标：

- 建立标准目录结构
- 写清楚架构、约束、工具策略、Agent Loop
- 建立 skills 文档
- 建立施工日志和实时进度日志

验收标准：

- 目录结构存在
- `docs/` 关键文档存在
- `skills/` 关键文档存在
- `docs/LOG.md` 已记录本次施工

## Phase 1：Gateway + Queue + Worker

目标：

- 建立入口层、队列层、消费层的 wrapper 与类型边界
- 明确任务对象和任务状态流转

验收标准：

- 能创建任务
- 能入队和出队
- 能驱动单 worker 消费

## Phase 2：Harness + Context + Skills

目标：

- 管理 run 生命周期
- 加载文档、workspace 摘要、session history
- 注入 skill 说明

验收标准：

- 能生成 run 上下文
- 能选择并加载 skill 文本
- 能输出 final report 骨架

## Phase 3：Runner + EventBus

目标：

- 建立受控 ReAct Loop 骨架
- 建立事件定义和订阅机制

验收标准：

- Runner 只能通过 EventBus 请求工具
- EventBus 支持 tool request/result/failed

## Phase 4：Tool Registry + Executor

目标：

- 注册工具定义
- 建立权限、路径、命令边界
- Executor 作为唯一副作用边界

验收标准：

- 工具可以被解析
- Executor 可以处理工具请求
- 非法请求会被 guard 拦截

## Phase 5：Policy Guard + Tools

目标：

- 实现最小工具集
- 完成路径、权限、命令约束

验收标准：

- `list_files`
- `read_file`
- `write_file`
- `patch_file`
- `shell_exec`
- `git_diff`

## Phase 6：Final Report + Logs

目标：

- 完成 run 级日志
- 完成 JSONL 事件日志
- 完成最终报告

验收标准：

- `logs/catnip.jsonl` 可追加记录
- `docs/LOG.md` 按施工记录更新
- final report 输出修改摘要、风险、回滚建议

## DeepSeek 接入计划

DeepSeek 不是当前阶段目标，但已列入后续 Runner 接入方向。

建议接入顺序：

1. 先完成模型无关 Runner 接口。
2. 再抽象 provider adapter。
3. 最后将 DeepSeek 作为默认 provider 接入。
