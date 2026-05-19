# Development Progress

## 2026-05-18

### 进行中

- 评估更细的失败分类、恢复策略与运行级验收结构

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
- 完成 Phase 4 最小骨架：Tool Registry 工具元数据扩展、Executor guard 准入检查
- 完成 Phase 5 第一批最小只读工具：`list_files`、`read_file`、`git_diff`
- 完成 Phase 6 最小闭环：JSONL 事件日志、run report 落盘、`npm test`
- 完成扩展工具集：`write_file`、`patch_file`、`shell_exec` 与基础工具路由
- 完成 Runner 扩展：provider adapter 骨架、多步工具计划、最终回答摘要
- 完成 AI SDK provider adapter 骨架与环境驱动选择
- 完成 DeepSeek 直连 provider、本地 secrets 自动加载与在线计划验证
- 完成 DeepSeek 在 Runner 内通过 AI SDK tool calling 直连 EventBus
- 完成 CLI 可手测增强：单次命令、交互模式、stdin 管道输入、最终回答回显
- 完成 CLI 结果透传：Worker 将 `runId`、`finalAnswer`、`stepsUsed`、`toolSummaryCount` 回写到任务状态
- 完成 CLI 交互命令：`/history`、`/last`、`/clear`
- 完成交互模式 EOF 关闭修复，支持管道输入后正常退出
- 完成 CLI 调试输出：`--debug` 与 `CATNIP_CLI_DEBUG=1`
- 完成本地 trace 日志：`logs/catnip-trace.jsonl`
- 完成 prompt / plan / reasoning summary 事件落盘与实时打印
- 完成 CLI 层状态线实时打印
- 完成 CLI 紧凑时间线输出：`[queue] / [run] / [stage] / [context] / [plan] / [think] / [act] / [done] / [answer]`
- 完成 CLI 运行中计时心跳输出：`[timer]`
- 完成 CLI 多任务编排入口：`--task`、`-t`、`--tasks-file`
- 完成 CLI 批量任务编排汇总：`[orchestrator]`
- 完成交互模式运行中补充输入捕获
- 完成交互模式 follow-up refinement 自动续跑
- 完成 Worker 线程池式消费配置：`CATNIP_WORKER_COUNT`
- 完成 Worker 心跳频率配置：`CATNIP_WORKER_HEARTBEAT_MS`
- 完成 Worker 聚合心跳字段：`activeWorkers`、`idleWorkers`、`queueDepth`、`completedTasks`、`failedTasks`
- 完成 `run.started / run.heartbeat / agent.step.finished / run.finished` 调试追踪
- 完成 Runner 统一运行限制：`maxSteps`、工具失败重试、失败后可选继续
- 完成 Harness run 级超时包装与 `TimeoutError` 失败分类
- 完成运行限制环境变量：`CATNIP_RUNNER_MAX_STEPS`、`CATNIP_RUNNER_MAX_TOOL_RETRIES`、`CATNIP_RUNNER_CONTINUE_ON_TOOL_ERROR`、`CATNIP_RUN_TIMEOUT_MS`
- 完成超时与运行限制测试：`tests/harness.test.ts`、`tests/runner.test.ts`
- 完成队列动态状态观测：`queuePosition`、`updatedAt`、`queue.subscribe`
- 完成 CLI 队列等待显示：`[queue]` 待处理位置、`[wait]` 等待时间、结果页 `queueWaitMs / totalDurationMs`
- 完成 CLI 更像 coding agent 的改动回显：`write_file` 预览、`patch_file` 替换摘要、交互提示改为 `codex@catnip>`
- 完成 Worker 失败分类透传：`failureKind=timeout|runtime`
- 将默认运行超时从 `60000` 提升到 `180000`
- 完成新增测试：`tests/queue.test.ts`、`tests/gateway.test.ts`、`tests/worker.test.ts`、`tests/tools.test.ts`
- 完成浏览器预览工具：`open_browser`
- 完成浏览器预览 guard：仅允许 `workspaces/demo/*.html`
- 完成 runner HTML 预览链路：`write_file -> open_browser`
- 完成网络搜索工具：`web_search`
- 完成浏览器搜索工具：`open_browser_search`
- 完成 runner 搜索链路：`web_search -> open_browser_search`
- 固化 GitHub 主线命名规则：当前主线名 `catnipent 1.0`
- 固化 GitHub 上传记录规则：每次上传都要标记改动部分，`docs/LOG.md` 必写版本号
- 完成浏览器打开链接工具：`open_url`
- 完成单猫启动进入动画
- 默认 `CATNIP_RUNNER_MAX_STEPS` 从 `5` 提升到 `10`
- 强化主施工文档：新增每次开工前与每次收尾强制清单
- 强化主施工文档：明确每轮代码开发都必须检查日志、push 与回滚判断
- 强化主施工文档：默认每次开发完成后上传，并持续明确回滚规则
- 强化主施工文档：每次开发前必须先上传备份
- 强化主施工文档：如出问题默认回滚到上一版本并告知测试命令
- `npm run typecheck` 通过
- `npm run build` 通过
- `npm test` 通过
- `node dist/src/main.js "phase1 smoke test"` 冒烟通过
- `node dist/src/main.js "phase2 context and skills smoke test"` 冒烟通过
- `node dist/src/main.js "phase3 tool event smoke test"` 冒烟通过
- `node dist/src/main.js "phase4 guard skeleton smoke test"` 冒烟通过
- `node dist/src/main.js "phase5 readonly tool smoke test"` 冒烟通过
- `node dist/src/main.js "phase6 logs and tests smoke test"` 冒烟通过
- `node dist/src/main.js "write file smoke test"` 冒烟通过
- `node dist/src/main.js "patch file smoke test"` 冒烟通过
- `node dist/src/main.js "shell smoke test"` 冒烟通过
- `node dist/src/main.js "write file then patch file and shell status"` 多步冒烟通过
- `node dist/src/main.js "write file then patch file and shell status"` 在无 key 默认 heuristic 下通过
- `node dist/src/main.js "readme and git diff"` 在本地 DeepSeek provider 下通过
- `node dist/src/main.js "readme and git diff"` 在本地 DeepSeek AI SDK tool calling 下通过
- `node dist/src/main.js "readme and git diff"` 在增强版 CLI 输出下通过
- `printf 'readme and git diff\\n/history\\n/clear\\n/history\\n/exit\\n' | node dist/src/main.js --interactive` 通过
- `CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js --debug "readme and git diff"` 通过
- `CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js --debug "create file workspaces/demo/hello2.html and write a complete minimal html document whose body says 你好世界2"` 通过
- `node dist/src/main.js --task "readme and git diff" --task "shell status"` 通过
- `CATNIP_WORKER_COUNT=2 CATNIP_CLI_DEBUG=1 node dist/src/main.js --task "readme and git diff" --task "shell status"` 通过
- `CATNIP_RUN_TIMEOUT_MS=12000 CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js "帮我用王小波的风格写一下被掩埋的巨人"` 通过，并确认输出 `[timer]`
- `node dist/src/main.js "readme and git diff"` 通过，并确认输出队列等待、计时心跳和结果页等待时长
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "create file html and open browser run html"` 通过
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "web search latest catnip agent runtime and open browser search"` 通过
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "open url https://example.com/result"` 通过

### 未开始

- GitHub 仓库实际接入
- 更细的失败分类与恢复策略
- 运行级验收与回滚建议结构化输出

### 备注

本文件作为实时开发进度日志持续追加，不覆盖旧记录。
后续所有 Codex 必须先读 `CODEX_MASTER_REQUIREMENTS.md` 再继续开发。
当前 GitHub 状态：远程已接入，当前分支 `main` 已可 push。
当前安全状态：真实 API Key 不得写入仓库文档，需本地保管并建议轮换。
当前文档状态：子目录文档已从占位说明提升为可执行说明。
当前工程状态：已具备可 typecheck 的 TypeScript 骨架，但业务逻辑仍是占位实现。
