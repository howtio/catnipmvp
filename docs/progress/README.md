# Progress System

本目录用于让不同设备、不同会话、不同 Codex 连续接力开发。

读取顺序：

1. `CODEX_MASTER_REQUIREMENTS.md`
2. `docs/DEV_PROGRESS.md`
3. `docs/LOG.md`
4. `docs/progress/layers/*.md`

写入规则：

- 总进度写入 `docs/DEV_PROGRESS.md`
- 每轮施工写入 `docs/LOG.md`
- 某一层有开发动作时，必须追加对应层日志
- 不覆盖旧记录，只追加
