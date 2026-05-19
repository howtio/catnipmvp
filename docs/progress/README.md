# Progress System

本目录用于让不同设备、不同会话、不同 Codex 连续接力开发，并保证进度记录能追溯到层级。

## 读取顺序

1. `CODEX_MASTER_REQUIREMENTS.md`
2. `docs/DEV_PROGRESS.md`
3. `docs/LOG.md`
4. `docs/progress/layers/*.md`

## 写入规则

- 总进度写入 `docs/DEV_PROGRESS.md`
- 每轮施工写入 `docs/LOG.md`
- 某一层有开发动作时，必须追加对应层日志
- 不覆盖旧记录，只追加

## 使用原则

- 先读再改，不允许跳过历史记录直接开发
- 先记目标，再动手实现
- 发生阻塞、测试失败、回滚时必须即时追加
- 每次收尾都要检查 GitHub 上传是否已处理
- 每次收尾都要检查回滚判断是否已记录
