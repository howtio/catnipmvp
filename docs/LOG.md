# Construction Log

## 2026-05-19 / Large Step / 接通 DeepSeek 的 AI SDK tool calling

### 目标

把真实模型链路从“只生成结构化计划”继续推进到“在 Runner 内直接通过 AI SDK tools 发起工具调用”，同时保持实际工具执行仍然只经 EventBus 和 Executor。

### 本次修改

- 为 `RunnerProvider` 增加可选 `runWithTools`
- `createDeepSeekRunnerProvider` 改为支持 AI SDK `generateText + tools + stopWhen`
- 在 Runner wrapper 中抽取 `executeToolCall`，作为 provider-driven loop 的统一执行入口
- 新增模型工具调用参数归一化
- 修正 AI SDK tool-calling 分支的 `toolSummaryCount`
- 验证真实 DeepSeek 在 tool calling 模式下成功跑通

### 修改文件

- src/layers/07-runner/index.ts
- src/layers/07-runner/planner.ts
- src/layers/07-runner/provider.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，12 个测试全部通过
- `node dist/src/main.js "readme and git diff"`：通过
- `logs/catnip.jsonl`：确认 DeepSeek 通过 AI SDK tool calling 发起工具调用并产出 `run.report`

### 风险

- 当前真实模型在复杂任务下仍可能花较长时间才结束，需要补超时和步数限制策略
- tool schemas 仍是最小版，复杂 patch/shell 输入约束还不够细
- DeepSeek 在线行为稳定性还需要更多真实任务验证

### 下一步

- 统一 Runner 的 step 上限、超时和失败恢复
- 或继续细化 tool schemas 与 guard repair 逻辑

## 2026-05-18 / Large Step / 本地 secrets 与 DeepSeek 直连 provider

### 目标

把用户本地提供的 DeepSeek 密钥收进 Git 忽略目录，并让 Runner 可以在本地自动加载 secrets 后直接走 DeepSeek provider。

### 本次修改

- 将 `.local-secrets/` 加入 `.gitignore`
- 建立 `.local-secrets/` 目录约定
- 新增 `loadLocalEnvFiles`，在 bootstrap 时自动加载 `.local-secrets/*.env`
- 安装 `@ai-sdk/deepseek`
- 新增 `createDeepSeekRunnerProvider`
- 扩展 `createRunnerProviderFromEnv`，支持 `deepseek` 模式与自动回退
- 修正模型输出工具参数不完整时的归一化逻辑

### 修改文件

- .gitignore
- package.json
- package-lock.json
- src/bootstrap.ts
- src/shared/utils/loadLocalEnv.ts
- src/layers/07-runner/index.ts
- src/layers/07-runner/provider.ts
- tests/runner.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，12 个测试全部通过
- `node dist/src/main.js "readme and git diff"`：通过
- 在本地 DeepSeek provider 下，成功完成 `read_file` 与 `git_diff` 两步计划

### 风险

- 用户在会话里直接发过密钥，该密钥应视为已暴露，建议后续轮换
- 当前 DeepSeek provider 只做结构化计划生成，还未进入 AI SDK tool calling 模式
- `.local-secrets/` 为本地约定，不适合跨环境自动分发

### 下一步

- 接 AI SDK tool calling
- 或补 Runner 的 step 上限、超时和失败恢复

## 2026-05-18 / Large Step / 接入 AI SDK provider adapter 骨架

### 目标

在不破坏现有 heuristic 默认链路的前提下，把 AI SDK provider adapter 接入 `07-runner`，为后续真实模型计划生成留出落点。

### 本次修改

- 安装 `ai` 与 `zod`
- 在 Runner provider 中新增 AI SDK structured output 方案
- 使用 `generateObject` 生成结构化工具计划
- 增加 `createRunnerProviderFromEnv`
- 支持 `CATNIP_RUNNER_PROVIDER=auto|heuristic|ai-sdk`
- 在无 `AI_GATEWAY_API_KEY` 时默认回退到 heuristic provider
- 更新 `.env.example`，加入 AI Gateway 相关变量

### 修改文件

- package.json
- package-lock.json
- .env.example
- src/bootstrap.ts
- src/layers/07-runner/index.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/provider.ts
- src/layers/07-runner/wrapper.ts
- tests/runner.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，11 个测试全部通过
- `node dist/src/main.js "write file then patch file and shell status"`：通过
- 默认无 `AI_GATEWAY_API_KEY` 时，provider 自动回退到 heuristic

### 风险

- 当前 AI SDK provider 只负责结构化计划生成，尚未接入工具调用式模型循环
- 仓库里没有可用于真实调用的 `AI_GATEWAY_API_KEY`，所以还未做在线集成验证
- 目前仍未直连 DeepSeek 平台，走的是 AI Gateway 模型字符串方案

### 下一步

- 接入 AI SDK tool calling 或更完整的 step 控制
- 在有真实 key 的环境下验证 AI SDK provider 计划输出

## 2026-05-18 / Large Step / Runner 多步计划与 provider adapter 骨架

### 目标

按更大跨度推进 Runner，把它从“单步关键词路由”升级到“可规划多步工具调用并生成最终回答”的骨架，同时为后续 AI SDK provider 留出稳定接口。

### 本次修改

- 新增 `RunnerProvider` 接口
- 新增本地 `createHeuristicRunnerProvider`
- 新增 Runner planner 与工具结果摘要逻辑
- Runner 改为执行多步工具计划，而非单次固定调用
- 新增 `agent.answer.produced` 事件
- Harness report 增加 `stepsUsed`、`finalAnswer`、`toolSummaryCount`
- 新增 Runner 相关测试

### 修改文件

- src/bootstrap.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/07-runner/index.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/07-runner/planner.ts
- src/shared/types/event.ts
- tests/runner.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，10 个测试全部通过
- `node dist/src/main.js "write file then patch file and shell status"`：通过
- `logs/catnip.jsonl`：确认写入 3 次工具调用、`agent.answer.produced` 与增强版 `run.report`

### 风险

- 当前 provider 仍是 heuristic 规则，不是真实模型
- 还没有 step 上限、超时、重试策略
- 最终回答目前是工具摘要，不是自然语言高质量生成

### 下一步

- 接入 AI SDK provider adapter
- 或继续细化 Runner 的 step 限制和失败恢复策略

## 2026-05-18 / Post Phase 6 / 扩展剩余工具与更细 guard

### 目标

按更大跨度继续推进，把剩余最小工具实现、shell 白名单 guard 和基础工具路由一并补齐。

### 本次修改

- 将 `write_file`、`patch_file`、`shell_exec` 标记为 `active`
- Executor 新增 `write_file`、`patch_file`、`shell_exec` 的真实最小实现
- guard 增加 shell 命令白名单校验
- guard 为 `write_file`、`patch_file` 增加路径边界检查
- Runner 改为按任务输入做最小工具路由，而不是固定调用 `list_files`
- 扩展自动化测试，覆盖新工具和 shell guard

### 修改文件

- src/layers/07-runner/wrapper.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- tests/guard.test.ts
- tests/tools.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，8 个测试全部通过
- `node dist/src/main.js "write file smoke test"`：通过
- `node dist/src/main.js "patch file smoke test"`：通过
- `node dist/src/main.js "shell smoke test"`：通过

### 风险

- `patch_file` 当前是受控字符串替换，不是通用 patch 语法
- `shell_exec` 当前仍只支持严格白名单命令
- Runner 只是关键词路由，还不是完整 ReAct Loop

### 下一步

- 继续做 Runner 的多步决策和 provider adapter
- 或细化工具参数 schema 与更强的 pathGuard / commandGuard

## 2026-05-18 / Phase 6 / 打通 JSONL 日志、run report 与基础测试

### 目标

补齐最小可观测性和回归验证能力，让事件日志、run report 和自动化测试形成基本闭环。

### 本次修改

- `JsonlLogger` 改为真实落盘到 `logs/catnip.jsonl`
- EventBus 在发布事件时自动写 JSONL
- Harness 在 run 完成时写入 `run.report`
- 新增 `npm test` 脚本，使用 `node:test`
- 新增 guard 与只读工具执行的基础测试
- 扩展 `tsconfig.json` 以编译测试文件

### 修改文件

- package.json
- tsconfig.json
- src/bootstrap.ts
- src/shared/logger/jsonlLogger.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/08-eventbus/wrapper.ts
- tests/guard.test.ts
- tests/tools.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/08-eventbus.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，4 个测试全部通过
- `node dist/src/main.js "phase6 logs and tests smoke test"`：通过
- `logs/catnip.jsonl`：成功写入事件与 `run.report`

### 风险

- 当前测试仍以基础单元测试为主，尚未覆盖完整端到端场景
- JSONL 日志当前只做追加写入，没有轮转或大小控制
- final report 目前进入 JSONL，但还没有单独的报表文件或查询接口

### 下一步

- 继续补 `write_file`、`patch_file`、`shell_exec`
- 或开始设计更完整的 Runner 决策与 provider adapter

## 2026-05-18 / Phase 5 / 落地第一批只读工具

### 目标

先实现最安全的最小工具集，把 `list_files`、`read_file`、`git_diff` 从定义推进到真实执行，同时把 guard 补到基础路径边界。

### 本次修改

- 将 `list_files`、`read_file`、`git_diff` 标记为 `active`
- 新增 Executor 工具实现文件 `tools.ts`
- 实现 `list_files` 目录读取
- 实现 `read_file` 文件读取
- 实现 `git_diff` 只读 git diff 获取
- 在 guard 中增加最小路径边界检查，防止 `read_file` 和 `list_files` 越过 workspace

### 修改文件

- src/shared/types/tool.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- src/layers/10-executor/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "phase5 readonly tool smoke test"`：通过

### 风险

- `write_file`、`patch_file`、`shell_exec` 仍未落地
- Runner 当前仍只做固定工具选择，尚未根据任务内容路由到具体工具
- `git_diff` 已是只读执行，但 shell 类命令 guard 还未实现

### 下一步

- 进入 Phase 6，补日志、最终报告输出和测试框架
- 或在需要时继续补写入类工具与更细的 guard

## 2026-05-18 / Phase 4 / 建立 Tool Registry 与 Executor guard 骨架

### 目标

在不进入真实副作用执行的前提下，补齐工具定义元数据和 Executor 执行前准入检查骨架。

### 本次修改

- 扩展 `ToolDefinition`，增加 `category`、`argShape`、`stage`
- 在 Tool Registry 中补齐后续计划工具的元数据占位
- 新增 `guardToolCall`，统一校验工具注册、权限匹配、参数结构、workspaceRoot
- Executor 改为先运行 guard，再返回统一成功或失败事件
- 修正 Executor 事件类型与通用事件总线的兼容问题

### 修改文件

- src/bootstrap.ts
- src/shared/types/tool.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/types.ts
- src/layers/10-executor/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "phase4 guard skeleton smoke test"`：通过

### 风险

- guard 当前只做最小结构校验，尚未实现 pathGuard 和 commandGuard
- 工具仍返回模拟结果，尚未进入真实文件和命令副作用执行
- Tool Registry 目前只有元数据，还没有参数 schema 和执行器绑定

### 下一步

- 进入 Phase 5，实现最小工具集和更细的 guard 规则
- 保持每阶段完成后验证、写日志、提交推送

## 2026-05-18 / Phase 3 / 打通最小工具事件链路

### 目标

让 Runner、EventBus、Tool Registry、Executor 不再只是独立骨架，而是形成一条最小可观察的工具调用事件闭环。

### 本次修改

- EventBus 增加 `subscribe` 和 `waitForToolResult`
- Tool Registry 增加 `getTool` 解析接口
- Runner 改为发起 `tool.call.requested` 并等待工具结果
- Executor 监听工具请求并返回模拟 `tool.call.result / tool.call.failed`
- 修正工具结果监听的时序问题，先挂监听再发请求

### 修改文件

- src/bootstrap.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- src/layers/08-eventbus/index.ts
- src/layers/08-eventbus/types.ts
- src/layers/08-eventbus/wrapper.ts
- src/layers/09-tool-registry/types.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/types.ts
- src/layers/10-executor/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/08-eventbus.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "phase3 tool event smoke test"`：通过

### 风险

- 当前工具结果仍是模拟数据，尚未进入真实副作用执行
- EventBus 还没有超时和取消机制
- Runner 目前只做单次最小工具请求，尚未形成完整 ReAct Loop

### 下一步

- 进入 Phase 4，细化工具定义、权限边界和 Executor guard 骨架
- 继续保持每阶段完成后验证、写日志、提交推送

## 2026-05-18 / Phase 2 / 打通 Harness Context Skills 最小运行编排

### 目标

在保持 Runner 仍为骨架的前提下，补齐单次 run 的生命周期管理、核心文档装载和 skills 说明注入。

### 本次修改

- Harness 增加 `runId`、`run.started / run.finished / run.heartbeat` 事件和 final report 骨架
- Context 改为读取核心文档摘要并生成 workspace 摘要、system prompt
- Skills 改为扫描 `skills/*/SKILL.md`，按任务输入选择并加载技能说明
- Runner 使用真实 `runId` 发布 step 完成事件
- Bootstrap 更新为把 EventBus 注入 Harness

### 修改文件

- src/bootstrap.ts
- src/layers/03-worker/types.ts
- src/layers/04-harness/index.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/05-context/index.ts
- src/layers/05-context/types.ts
- src/layers/05-context/wrapper.ts
- src/layers/06-skills/index.ts
- src/layers/06-skills/types.ts
- src/layers/06-skills/wrapper.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/05-context.md
- docs/progress/layers/06-skills.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "phase2 context and skills smoke test"`：通过

### 风险

- Context 当前只做摘要读取，尚未构建更细粒度的 workspace 上下文
- Skills 选择策略仍是最小关键词规则，后续需要更稳定的 registry 策略
- Harness 已生成 final report 骨架，但尚未落到日志文件或独立输出对象

### 下一步

- 进入 Phase 3，细化 Runner / EventBus / Tool Registry / Executor 骨架和工具事件链路
- 保持每阶段完成后先验证、再写日志、再提交推送

## 2026-05-18 / Phase 1 / 打通 Gateway Queue Worker 最小任务链路

### 目标

在不进入 AI SDK 和真实工具执行阶段的前提下，完成可运行的 CLI 任务创建、队列状态维护和单 Worker 消费链路。

### 本次修改

- Gateway 改为读取 CLI 输入并创建标准 `RunTask`
- Queue 增加任务快照、完成等待和任务通知能力
- Worker 改为通知式消费任务，并维护 `running / done / failed` 状态流转
- 为 `RunTask` 增加开始时间、结束时间和错误信息字段
- 修正空轮询导致的 CLI 退出行为，改为按任务到达唤醒消费

### 修改文件

- src/shared/types/runTask.ts
- src/layers/01-gateway/types.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/02-queue/index.ts
- src/layers/02-queue/types.ts
- src/layers/02-queue/wrapper.ts
- src/layers/03-worker/types.ts
- src/layers/03-worker/wrapper.ts
- src/bootstrap.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/02-queue.md
- docs/progress/layers/03-worker.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "phase1 smoke test"`：通过

### 风险

- Worker 当前仍为单实例无限消费循环，尚未加入关闭机制
- Queue 仍为内存实现，进程退出后任务状态不会持久化
- Harness / Context / Skills 仍是占位串联，尚未产出完整 run 报告

### 下一步

- 进入 Phase 2，细化 Harness 生命周期、Context 文档加载和 Skills 注入
- 继续保持每阶段完成后做构建验证和日志回写

## 2026-05-18 / Phase 0 / 文档与目录骨架初始化

### 目标

先建立项目目录和文档框架，不写实现代码，并为后续 DeepSeek 接入预留计划说明。

### 本次修改

- 创建十层架构目录
- 创建 shared、skills、docs、logs、workspaces、tests 目录
- 编写架构、分层契约、施工计划、工具策略、Agent Loop、调试指南
- 建立实时开发进度日志

### 修改文件

- docs/ARCHITECTURE.md
- docs/CONSTRUCTION_PLAN.md
- docs/LAYER_CONTRACT.md
- docs/TOOL_POLICY.md
- docs/AGENT_LOOP.md
- docs/DEBUG_GUIDE.md
- docs/LOG.md
- docs/DEV_PROGRESS.md
- skills/coding/SKILL.md
- skills/testing/SKILL.md
- 各层 README 文档

### 验证结果

- 目录创建：成功
- 代码文件创建：未执行
- typecheck：未执行
- 测试：未执行

### 风险

- 当前仅有文档和目录，尚未建立可运行入口
- 层内 `.ts` 文件尚未创建，后续实现时需要严格遵守 import 边界
- DeepSeek 仅有计划描述，尚未验证接入方式

### 下一步

- 为每层补齐 `README` 外的空实现文件或类型骨架
- 初始化 TypeScript 配置
- 建立 bootstrap 与 main 的最小可运行壳层

## 2026-05-18 / Phase 0 / 建立总指令与接力进度体系

### 目标

建立一个跨设备、跨会话、跨 Codex 可持续接力的最高优先级总需求文档，并明确线程池、心跳、分层进度日志规则。

### 本次修改

- 创建根级最高优先级文档 `CODEX_MASTER_REQUIREMENTS.md`
- 新增 `docs/progress/` 进度体系
- 为 10 层分别创建进度日志
- 明确线程池归属 Worker 层
- 明确心跳主归属 Worker 层，事件传播归属 EventBus，run 级观测归属 Harness
- 更新总进度文档

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/progress/README.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/02-queue.md
- docs/progress/layers/03-worker.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/05-context.md
- docs/progress/layers/06-skills.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/08-eventbus.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 主文档创建：成功
- 分层进度日志创建：成功
- 代码实现：未执行
- typecheck：未执行

### 风险

- 当前规则已经明确，但还未通过代码结构验证
- 后续实现阶段必须严格防止 Queue 侵入并发调度职责
- 心跳事件类型需要在 EventBus 设计阶段统一命名

### 下一步

- 继续完善文档体系或开始初始化 TypeScript 基础文件
- 进入代码阶段前先补齐空骨架文件和对外入口约束

## 2026-05-18 / Phase 0 / 增加测试与 GitHub 回滚规则

### 目标

强化总指令文档，明确代码完成后的测试流程、失败后的回滚策略，以及后续接入 GitHub 仓库时必须由用户提供的信息。

### 本次修改

- 在主文档中新增代码完成后的测试规则
- 在主文档中新增 GitHub 协作与回滚规则
- 在主文档中新增仓库接入所需信息清单
- 在主文档中新增新 Codex 连接仓库后的首轮检查要求
- 更新总进度文档

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 主文档增强：成功
- 代码实现：未执行
- typecheck：未执行
- 测试：未执行

### 风险

- 目前测试命令和回滚权限仍未从真实仓库获得
- 没有仓库信息前，测试与回滚规则只能写成框架约束

### 下一步

- 等你提供 GitHub 仓库信息
- 然后把仓库专属测试命令和回滚策略进一步固化到主文档

## 2026-05-18 / Phase 0 / 记录 GitHub 仓库地址与接入阻塞

### 目标

记录用户提供的 GitHub 仓库地址，并把当前仓库接入阻塞写入主文档和进度文档。

### 本次修改

- 记录 GitHub 仓库地址 `https://github.com/howtio/catnipmvp.git`
- 记录当前工作目录不是 git 仓库
- 记录当前环境读取远程仓库需要凭证
- 在主文档中补充私有仓库场景下仍需用户提供的信息

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 本地 git 状态检查：失败，当前目录不是 git 仓库
- 远程分支读取：失败，需要 GitHub 凭证
- 代码实现：未执行

### 风险

- 在未 clone 或未配置凭证前，无法制定仓库级测试与回滚方案
- 无法确认默认分支、当前工作分支、未提交改动状态

### 下一步

- 由用户提供剩余仓库信息或先完成 clone / 凭证配置
- 然后再把仓库专属分支与回滚规则固化到主文档

## 2026-05-18 / Phase 0 / 完成 GitHub 仓库首次接入与推送

### 目标

把当前本地文档骨架初始化为 git 仓库，接入 GitHub 远程仓库，并完成首次推送。

### 本次修改

- 初始化本地 git 仓库
- 设置当前分支为 `main`
- 添加并提交当前文档骨架
- 配置 GitHub SSH remote
- 处理 SSH 22 端口不可达问题，改用 `ssh.github.com:443`
- 合并远程仓库已有的初始 `README.md` 提交
- 成功推送本地 `main` 到远程仓库
- 更新主文档与总进度文档中的仓库状态

### 修改文件

- /home/howtion/.ssh/config
- README.md
- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- `ssh -T git@github.com`：成功认证
- `git fetch origin main`：成功
- `git merge origin/main --allow-unrelated-histories`：成功
- `git push -u origin main`：成功

### 风险

- 当前 SSH 依赖 `ssh.github.com:443` 通道，后续环境变化时需重新验证
- 目前仓库仍以文档骨架为主，尚未进入代码与测试阶段

### 下一步

- 继续强化主文档中的仓库专属测试与回滚策略
- 或进入 TypeScript 基础骨架阶段

## 2026-05-18 / Phase 0 / 强化安全、调试、上传、回滚与实时日志标准

### 目标

把主文档强化成后续可长期接力使用的总施工标准，补齐安全、调试、上传、回滚、实时日志规则，并检查不稳妥点。

### 本次修改

- 补充 DeepSeek API Key 安全规则
- 明确真实密钥不能写入仓库文档
- 明确用户在会话中暴露过的密钥应视为已暴露并建议轮换
- 补充分阶段测试标准和测试失败处理标准
- 补充调试标准
- 补充上传标准
- 补充回滚标准
- 强化实时日志要求
- 修正文档中“自动 push”与“直推 main”的不稳妥表达

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 主文档规则增强：成功
- 代码实现：未执行
- typecheck：未执行
- 测试：未执行

### 风险

- DeepSeek 的实际命令、SDK 形式和运行脚本仍未落地
- 当前测试命令仍未最终固化到 `package.json`
- 文档规则已较完整，但仍需在代码阶段持续校准

### 下一步

- 开始补 `.env.example` 和 `.gitignore` 的安全占位规则
- 或进入 TypeScript 基础骨架阶段

## 2026-05-18 / Phase 0 / 润色子目录文档

### 目标

把各子目录下仍偏占位的文档润色为可执行说明，统一与总施工文档的职责边界、日志要求和后续施工口径。

### 本次修改

- 润色十层 `README.md`
- 润色 `docs/progress/README.md`
- 润色 `skills/coding/SKILL.md` 与 `skills/testing/SKILL.md`
- 补充各层进度日志中的阻塞点与边界说明

### 修改文件

- src/layers/01-gateway/README.md
- src/layers/02-queue/README.md
- src/layers/03-worker/README.md
- src/layers/04-harness/README.md
- src/layers/05-context/README.md
- src/layers/06-skills/README.md
- src/layers/07-runner/README.md
- src/layers/08-eventbus/README.md
- src/layers/09-tool-registry/README.md
- src/layers/10-executor/README.md
- docs/progress/README.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/02-queue.md
- docs/progress/layers/03-worker.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/05-context.md
- docs/progress/layers/06-skills.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/08-eventbus.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md
- skills/coding/SKILL.md
- skills/testing/SKILL.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 文档一致性抽查：成功
- 代码实现：未执行
- typecheck：未执行
- 测试：未执行

### 风险

- 当前仍有少量总文档中的“下一步”内容需要后续同步更新
- 文档已经更完整，但真实脚本和命令仍需在代码阶段落地

### 下一步

- 修正文档里仍过时的“当前下一步”描述
- 或进入 TypeScript 基础骨架阶段

## 2026-05-18 / Phase 0 / 建立 TypeScript 与十层空代码骨架

### 目标

在不提前实现复杂业务逻辑的前提下，完成 TypeScript 基础配置、十层对外入口骨架、共享基础模块，并通过静态检查。

### 本次修改

- 创建 `package.json`、`tsconfig.json`、`.gitignore`、`.env.example`
- 创建 `src/main.ts` 和 `src/bootstrap.ts`
- 为十层分别创建 `wrapper.ts`、`types.ts`、`index.ts`
- 创建 `src/shared/types`、`src/shared/logger`、`src/shared/errors`、`src/shared/utils` 基础文件
- 修正主文档中过时的“当前下一步”、分支策略、测试命令描述
- 安装 TypeScript 与 Node 类型依赖

### 修改文件

- package.json
- package-lock.json
- tsconfig.json
- .gitignore
- .env.example
- src/main.ts
- src/bootstrap.ts
- src/layers/01-gateway/index.ts
- src/layers/01-gateway/types.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/02-queue/index.ts
- src/layers/02-queue/types.ts
- src/layers/02-queue/wrapper.ts
- src/layers/03-worker/index.ts
- src/layers/03-worker/types.ts
- src/layers/03-worker/wrapper.ts
- src/layers/04-harness/index.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/05-context/index.ts
- src/layers/05-context/types.ts
- src/layers/05-context/wrapper.ts
- src/layers/06-skills/index.ts
- src/layers/06-skills/types.ts
- src/layers/06-skills/wrapper.ts
- src/layers/07-runner/index.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- src/layers/08-eventbus/index.ts
- src/layers/08-eventbus/types.ts
- src/layers/08-eventbus/wrapper.ts
- src/layers/09-tool-registry/index.ts
- src/layers/09-tool-registry/types.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/index.ts
- src/layers/10-executor/types.ts
- src/layers/10-executor/wrapper.ts
- src/shared/types/runTask.ts
- src/shared/types/permission.ts
- src/shared/types/tool.ts
- src/shared/types/event.ts
- src/shared/types/result.ts
- src/shared/logger/jsonlLogger.ts
- src/shared/logger/consoleLogger.ts
- src/shared/logger/logEvent.ts
- src/shared/errors/CatnipError.ts
- src/shared/errors/PolicyError.ts
- src/shared/errors/ToolError.ts
- src/shared/errors/TimeoutError.ts
- src/shared/utils/sleep.ts
- src/shared/utils/createId.ts
- src/shared/utils/safeJson.ts
- src/shared/utils/assertNever.ts
- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- `npm install`：成功
- `npm run typecheck`：成功
- `npm run build`：成功

### 风险

- 目前十层实现仍是占位逻辑，不能视为业务完成
- `npm test` 仍未定义，测试框架尚未建立
- `main` 目前仍承载骨架阶段施工，后续代码功能开发更适合走功能分支

### 下一步

- 进入 Phase 1，先做 Queue 和 Worker 的最小可运行实现
- 再逐层补 Harness、Context、Skills 的真实骨架逻辑

## 2026-05-19 / CLI / 增强本地手测入口与结果回显

### 目标

优先提升本地 CLI 可测试性，让用户能在短期内直接输入任务并看到明显效果，而不是只支持最小单次参数运行。

### 本次修改

- 为 Gateway CLI 增加 `--help` / `--interactive`
- 增加无参数 TTY 交互模式
- 增加 stdin 管道输入支持
- 抽出统一单任务执行逻辑
- 在 CLI 侧输出 `runId`、`steps`、`tool summaries`、`durationMs`
- 在 CLI 侧输出 `finalAnswer`
- 扩展 `RunTask`，容纳最小运行结果字段
- 在 Worker 完成任务后把 Harness report 回写到任务状态
- 新增 CLI 参数解析测试
- 更新 README 的 CLI quick start

### 修改文件

- README.md
- src/layers/01-gateway/wrapper.ts
- src/layers/03-worker/types.ts
- src/layers/03-worker/wrapper.ts
- src/shared/types/runTask.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/03-worker.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，14 个测试全部通过
- `node dist/src/main.js "readme and git diff"`：通过
- 确认 CLI 输出包含 `runId`、`steps`、`tool summaries`、`durationMs` 与 `finalAnswer`

### 回滚判断

- 本轮首次验证出现 `03-worker` 的类型边界错误
- 已在当前分支局部修复 `WorkerLayerDeps.harness.runTask` 返回类型
- 修复后全部验证通过，因此不执行文件级回滚或提交级回滚

### 风险

- 交互模式当前没有显式 shutdown，只适合本地手测
- `finalAnswer` 较长时会直接打到终端，尚未做输出裁剪
- 当前 CLI 仍是文本入口，不支持结构化子命令

### 下一步

- 继续围绕 CLI 做会话体验和输出格式优化
- 或转入 Runner 的 step 上限、超时、失败恢复
