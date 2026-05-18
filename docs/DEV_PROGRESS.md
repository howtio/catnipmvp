# Development Progress

## 2026-05-18

### 进行中

- 强化主文档中的测试规则
- 强化 GitHub 仓库协作与回滚规则
- 记录当前 GitHub 仓库接入阻塞信息

### 已完成

- 创建 `src/layers/01-gateway` 到 `src/layers/10-executor`
- 创建 `src/shared`、`skills`、`docs`、`logs`、`workspaces/demo`、`tests`
- 写入核心施工文档
- 写入 skills 文档
- 创建 `CODEX_MASTER_REQUIREMENTS.md`
- 创建 `docs/progress/` 和 10 个分层进度日志
- 明确线程池归属 `03-worker`
- 明确心跳主归属 `03-worker`，传播归属 `08-eventbus`
- 明确代码完成后的测试流程
- 明确 GitHub 仓库测试与回滚所需信息
- 记录仓库地址 `https://github.com/howtio/catnipmvp.git`

### 未开始

- TypeScript 基础配置
- 代码骨架
- Runner provider 抽象
- DeepSeek 接入
- GitHub 仓库实际接入

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。
后续所有 Codex 必须先读 `CODEX_MASTER_REQUIREMENTS.md` 再继续开发。
当前阻塞：本地目录不是 git 仓库，且远程仓库访问需要凭证。
