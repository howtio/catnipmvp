# Development Progress

## 2026-05-18

### 进行中

- 推进 Phase 4 的 Tool Registry / Executor 权限边界细化与工具定义扩展

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
- 完成本地 git 初始化
- 完成远程仓库首次推送
- 完成 SSH over 443 连通
- 明确 DeepSeek 只能用环境变量注入
- 明确上传前测试与日志门槛
- 明确回滚后的复测与补日志要求
- 完成 `src/layers/*/README.md` 润色
- 完成 `skills/*/SKILL.md` 润色
- 完成 `docs/progress/` 说明文档润色
- 完成 `package.json`、`tsconfig.json`、`.gitignore`、`.env.example`
- 完成 `src/main.ts` 与 `src/bootstrap.ts`
- 完成十层 `wrapper.ts / types.ts / index.ts` 空骨架
- 完成 `src/shared/types`、`logger`、`errors`、`utils` 基础文件
- 完成 Phase 1 最小链路：Gateway 创建 CLI 任务、Queue 状态等待、Worker 单任务消费
- 完成 Phase 2 最小链路：Harness run 生命周期、Context 文档装载、Skills 技能注入
- 完成 Phase 3 最小链路：Runner 工具请求、EventBus 等待结果、Executor 模拟返回
- `npm run typecheck` 通过
- `npm run build` 通过
- `node dist/src/main.js "phase1 smoke test"` 冒烟通过
- `node dist/src/main.js "phase2 context and skills smoke test"` 冒烟通过
- `node dist/src/main.js "phase3 tool event smoke test"` 冒烟通过

### 未开始

- Runner provider 抽象
- DeepSeek 接入
- GitHub 仓库实际接入
- 测试框架与 `npm test` 脚本

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。
后续所有 Codex 必须先读 `CODEX_MASTER_REQUIREMENTS.md` 再继续开发。
当前 GitHub 状态：远程已接入，当前分支 `main` 已可 push。
当前安全状态：真实 API Key 不得写入仓库文档，需本地保管并建议轮换。
当前文档状态：子目录文档已从占位说明提升为可执行说明。
当前工程状态：已具备可 typecheck 的 TypeScript 骨架，但业务逻辑仍是占位实现。
