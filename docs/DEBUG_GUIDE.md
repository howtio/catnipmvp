# Debug Guide

## 当前阶段可检查项

当前没有可运行代码，可调试目标以结构和文档一致性为主。

## 结构检查

- 目录是否完整
- `docs/` 是否齐全
- `skills/` 是否齐全
- `logs/` 与 `workspaces/demo/` 是否存在

## 文档检查

- 架构说明是否和总施工文档一致
- 分层职责是否清晰
- Tool Policy 是否清晰
- DeepSeek 是否仅作为后续接入计划出现

## 后续调试方向

进入实现阶段后再补充：

- Gateway 调试
- Queue 状态流转
- Worker 消费循环
- Runner step 日志
- EventBus 工具事件追踪
- Executor 审计日志
