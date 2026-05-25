# Construction Log

## 2026-05-25 / Windows / windows3.0 本地 CPU 小模型支持

### 版本

- `windows3.0`

### 目标

替换 DeepSeek API 为本地 CPU 小模型（Ollama + deepseek-r1:1.5b / qwen2.5:0.5b），实现完全离线运行。

### 本次修改

- **新增 `src/layers/07-runner/local-provider.ts`**：基于 Ollama 的 OpenAI 兼容 API，通过 `@ai-sdk/openai` 连接
- **plan-only 模式**：小模型不支持 AI SDK tool calling，仅实现 `plan()`，工具执行由 Runner wrapper 顺序调度
- **支持 `CATNIP_RUNNER_PROVIDER=local`**：环境变量切换本地模式
- **支持 `CATNIP_LOCAL_MODEL`**：指定模型（默认 `deepseek-r1:1.5b`）
- **支持 `CATNIP_LOCAL_HOST`**：自定义 Ollama 地址（默认 `http://localhost:11434`）
- **provider 自动检测**：Ollama 运行状态检查、缺失模型自动拉取
- **`provider.ts`**：扩展 `createRunnerProviderFromEnv` 支持 local 模式与自动检测
- **`start-catnip.cmd`**：支持 `start-catnip local` 直接启动本地模式
- **`sea-config.json`**：输出从 `catnip-bundle.cjs` 改为 `catnip-sea.cjs`
- **`.local-secrets/local.env`**：新增本地模式环境变量文件
- **测试模型**：`deepseek-r1:1.5b`（1.1GB）、`qwen2.5:0.5b`（~400MB）、`qwen2.5:1.5b`（~900MB）
- **性能数据**：首次加载 ~70s，后续 ~7s（Ollama 模型缓存）

### 修改文件

- src/layers/07-runner/local-provider.ts (新增)
- src/layers/07-runner/provider.ts
- src/layers/07-runner/index.ts
- start-catnip.cmd
- sea-config.json
- docs/DEV_PROGRESS.md
- docs/LOG.md
- .local-secrets/local.env (新增，gitignored)

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过
- 本地 Qwen 2.5 0.5B 测试通过（plan-only 模式）
- 本地 DeepSeek-R1 1.5B 测试通过（plan-only 模式）
- SEA exe 编译通过（93MB），双击运行进入交互模式

### windows3.0 修复（2026-05-25）

- 修复 `getProjectRoot()` — 编译到 `dist/src/` 时多退一层目录，工具调用不再报 workspaceRoot 越界
- 修复空工具计划 — 模型认为不需要工具时，Runner 直接输出模型的最终回答，不再走 fallback 到 `list_files`
- 修复本地模型 prompt — `finalAnswerPrompt` 字段增加描述，提示明确要求模型直接回答用户问题
- 默认模型从 `deepseek-r1:1.5b` 改为 `qwen2.5:1.5b` — Qwen 无 thinking 开销，聊天/问答响应更好
- `start-catnip.cmd` 同步默认模型为 `qwen2.5:1.5b`
- 验证：`"你是谁"` → Qwen 2.5 1.5B 正确回答（4s），DeepSeek-R1 1.5B 正确返回空工具计划
- `.gitignore` 新增 `workspaces/demo/*` 防止运行时产物被提交

### windows3.0 修复 2（2026-05-25）

- **修复 heuristic fallback 不触发问题** — `allCallsAreDefault()` 对空数组返回 `false`，导致模型返回空工具计划时（"帮我写个python hello world"）heuristic 不会注入 `write_file`
- **重构为 `modelProducedNoMeaningfulCalls()`** — 对空数组返回 `true`，使 heuristic 能正确捕获模型未理解工具调用的情况
- **验证**：
  - `"你是谁"` → 0 工具调用，Qwen 2.5 1.5B 直接回答（2.2s）
  - `"帮我写个python hello world"` → 1 工具调用 `write_file`，写入 `workspaces/demo/task_output.py`（1.8s）
- SEA 可执行文件使用 Node 24.13.1 适配的 sentinel 重新编译

### windows3.0 修复 3（2026-05-25）

- **上下文不再加载开发文档** — `CODEX_MASTER_REQUIREMENTS.md`、`DEV_PROGRESS.md`、`LOG.md` 只在 `CATNIP_DEV_CONTEXT=1` 时加载。默认运行时 `docs=0`，模型不再收到无关的架构文档
- **1.5B 模型写任务强制走 heuristic** — 写/创建类任务 (`写|创建|create|make|generate`) 完全忽略模型的工具计划，直接注入 `write_file`。1.5B 模型无法可靠做结构化工具规划
- **验证**：
  - `"你是谁"` → `docs=0`，0 工具，模型直接回答（3s）
  - `"帮我写贪吃蛇python代码"` → `docs=0`，1 工具 `write_file`，写入 `task_output.py`（4.5s）
  - `"给我一首关于天气的诗"` → `docs=0`，0 工具，模型直接回答（2s）

### windows3.0 修复 4（2026-05-25）

- **Heuristic 全面覆盖所有工具类型** — 除 write_file 外，新增对以下任务模式的 heuristic 路由：
  - `打开浏览器/预览` → `open_browser`
  - `运行/执行/install/build` → `shell_exec`
  - `搜索/查找/query` → `web_search`
  - `打开链接/访问网站` → `open_url`
  - `readme` → `read_file`
  - `git diff/差异` → `git_diff`
  - `列出/目录/文件夹` → `list_files`
- **1.5B 模型仅用于 Q&A/纯聊天** — 任何匹配已知模式的任务完全跳过模型的工具计划，直接走 heuristic。不匹配的任务再回退到模型计划（经由 `modelProducedNoMeaningfulCalls` 过滤）
- **修复根目录旧 catnip.exe 未更新问题** — 编译后 `catnip.exe` 复制到项目根目录，确保用户双击/命令行运行的版本包含最新修复
- **验证**：
  - `"你是谁"` → heuristic 无匹配 → 模型回答（1.3s）
  - `"帮我打开浏览器"` → heuristic `open_browser`（正确路由，因文件不存在失败是预期行为）
  - `"帮我写贪吃蛇python代码"` → heuristic `write_file` 到 `task_output.py`（4.1s）
  - `"帮我写一首情书"` → heuristic `write_file` 到 `task_output.txt`（1.3s）
  - 所有 50 单元测试通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到 `feat/windows2.0` 分支基线提交

### 风险

- 小模型规划质量低于 DeepSeek API，复杂任务可能计划不合理
- Ollama 需要单独安装并作为 Windows 系统服务运行
- deepseek-r1 有 thinking 开销（首次 70s），qwen 系列无此问题
- SEA exe（93MB）因内嵌完整 Node.js 运行时，体积较大

### 下一步

- GitHub 仓库实际接入与持续集成
- 更细的失败分类与恢复策略
- 运行级验收与回滚建议结构化输出

## 2026-05-25 / Windows / windows2.0 平台兼容性优化与 SEA 独立 exe

### 版本

- `windows2.0`

### 目标

解决 DeepSeek 在 Windows 下运行的核心兼容性问题，包括路径分隔符、shell 命令白名单、系统提示、浏览器打开，并编译为独立双击可执行文件。

### 本次修改

- **guard.ts**：路径检查统一使用 `/` 分隔符比较（`normalizePathSeparators`），消除 `\` 与 `/` 不匹配问题；shell 命令白名单从严格 argv 匹配改为命令名白名单 + 危险前缀黑名单；browser 路径检查使用统一分隔符
- **tools.ts**：新增 `shellExec` 辅助函数，Windows 下自动通过 `cmd /c` 运行内置命令（`dir`、`type`、`echo` 等）；`git_diff` 容错处理（git 未安装时不抛异常）
- **provider.ts**：新增 `PLATFORM_HINT`，在 DeepSeek / AI SDK planner prompt 和 `runWithTools` system prompt 中告知模型当前为 Windows 环境，推荐使用 `dir`/`type`/`echo` 等命令
- **context/wrapper.ts**：新增 `PLATFORM_HINT`，base system prompt 中加入 Windows 说明；`workspaceRoot` 改为支持 `CATNIP_WORKSPACE_ROOT` 环境变量
- **bootstrap.ts**：新增 `PROJECT_ROOT` 检测逻辑，SEA exe 模式下使用 `process.execPath` 所在目录，避免双击 exe 时 cwd 不匹配；所有文件路径统一使用 `PROJECT_ROOT`
- **gateway/wrapper.ts**：新增 `isStandaloneExe()`，双击 exe 无参数时自动进入交互模式
- **CODEX_MASTER_REQUIREMENTS.md**：新增 GitHub 上传禁止规则（宪法级：不允许 Claude Code 标签/签名）
- **catnip.exe**：首次编译为 Node.js SEA 单文件可执行程序（92MB），双击即可运行
- **start-catnip.cmd**：双击启动器，自动加载密钥、编译、进入交互模式

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/TOOL_POLICY.md
- src/bootstrap.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/05-context/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- catnip.exe (新增)
- start-catnip.cmd (新增)
- .local-secrets/deepseek.env (新增，gitignored)

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `node dist/src/main.js "hello"`：通过（DeepSeek 真实调用）
- `./catnip.exe "hello"`：通过（SEA exe 独立运行）
- `./catnip.exe` 双击无参数 → 自动进入交互模式验证通过
- 交互模式 `"你是谁"` → DeepSeek 返回正确回答
- DeepSeek tool calling 链路：`write_file` → `list_files` → `shell_exec` → 模型回答验证通过

### 回滚判断

- 本轮不涉及 git 回滚（当前 Windows 目录未初始化 git 仓库）
- 如需要可手动还原 src/ 和 docs/ 下的修改

### 风险

- `catnip.exe` (92MB) 体积较大，因内嵌了完整 Node.js 运行时
- `cmd /c` 包装的内置命令可能不支持所有参数组合
- Windows 下 `git` 命令依赖 Git for Windows 是否在 PATH
- SEA exe 的数字签名因注入 blob 已失效，Windows Defender 可能报未知发布者

### 下一步

- 初始化 git 仓库并将 windows2.0 上传到 GitHub（不带 Claude 标签）
- 继续补 Windows shell 命令的更多兼容测试
- 可考虑 `.gitignore` 添加 `catnip.exe`

### 版本

- `catnipent 2.1`

### 目标

解决同一进程连续任务里 Memory 只能记摘要、不能记工作对象的问题，让“改这个游戏”“打开这个游戏”不再先重新扫描 workspace。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`bb94f0ed6698554e91064ec9908778f5e6be59f9`
- 开发前远端备份分支：`backup/pre-memory-working-set-20260519-2238`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- Memory 从摘要记忆升级为结构化 working memory
- 新增 `observations`，从工具结果抽取最近工作对象
- 新增 `workingSet`
- 新增 `focusedFilePath`
- 新增 `focusedOpenableHtmlPath`
- 新增 `recentFilePaths`
- 新增 `openableHtmlPaths`
- Memory 可从 `write_file`、`read_file`、`patch_file`、`open_browser`、`list_files`、`shell_exec cp/mv` 抽取对象
- Harness 把完整 `toolSummaries` 传给 Memory 回写
- heuristic provider 优先用 working memory 解析“这个游戏 / 这个文件 / 打开它 / 修这个页面”
- AI SDK / DeepSeek prompt 明确要求优先使用 working memory，避免重复扫描 workspace
- 新增 Memory 与 Runner 连续指代测试

### 改动部分

- `06.5-memory`：结构化工作记忆
- `04-harness`：tool summaries 回写
- `07-runner`：连续指代解析与 prompt 强化
- 文档与日志：`catnipent 2.1`
- 测试：working memory 与 referential task

### 修改文件

- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/06.5-memory.md
- docs/progress/layers/07-runner.md
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/06.5-memory/index.ts
- src/layers/06.5-memory/types.ts
- src/layers/06.5-memory/wrapper.ts
- src/layers/07-runner/provider.ts
- tests/memory.test.ts
- tests/runner.test.ts

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，50 个测试全部通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `bb94f0ed6698554e91064ec9908778f5e6be59f9`
- 暂不执行回滚

### 风险

- 当前 working memory 仍以“最近焦点”优先，不是完整实体链接系统
- 多个相似 html 产物同时存在时，后续仍需要更强冲突消解

### 下一步

- 可继续补多文件焦点排序
- 可继续补失败工具轨迹的 memory 保留

## 2026-05-19 / Memory / 插入 06.5 层并按 2.0 上传

### 版本

- `catnipent 2.0`

### 目标

按新版本要求把 `06.5-memory` 正式插入 `06-skills` 与 `07-runner` 之间，先改开发文档，再落地最小 session memory 闭环，并补测试、日志和上传记录。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`39afe1a0a7393da212fa8c1b1f6c137b62d37f92`
- 开发前远端备份分支：`backup/pre-memory-2-0-20260519-2108`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- 架构从原十层升级为含 `06.5-memory` 的 `11` 层结构
- 更新总工程指令、架构文档、层契约、Agent Loop、施工计划与总进度
- 新增 `docs/progress/layers/06.5-memory.md`
- 新增 `src/layers/06.5-memory/README.md`
- 新增 `src/layers/06.5-memory/types.ts`
- 新增 `src/layers/06.5-memory/wrapper.ts`
- 新增 `src/layers/06.5-memory/index.ts`
- Harness 主链路改为 `Context -> Skills -> Memory -> Runner`
- Memory 以 `sessionId` 维护进程内短期记忆
- Memory 注入最近任务输入、最终回答、步数和工具摘要计数
- Runner、provider、事件类型和 CLI 时间线同步适配 Memory 层
- 新增 `tests/memory.test.ts`
- 修正既有 CLI 启动画测试断言

### 改动部分

- 分层架构：`06.5-memory`
- 运行编排：Harness / Runner / prompt 事件
- CLI 观测：memory stage 与记忆计数
- 文档和日志：`catnipent 2.0`
- 测试：memory 新增覆盖与既有用例修正

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/AGENT_LOOP.md
- docs/ARCHITECTURE.md
- docs/CONSTRUCTION_PLAN.md
- docs/DEV_PROGRESS.md
- docs/LAYER_CONTRACT.md
- docs/LOG.md
- docs/progress/README.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/06.5-memory.md
- docs/progress/layers/07-runner.md
- src/bootstrap.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/06.5-memory/README.md
- src/layers/06.5-memory/index.ts
- src/layers/06.5-memory/types.ts
- src/layers/06.5-memory/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- src/shared/types/event.ts
- tests/gateway.test.ts
- tests/harness.test.ts
- tests/memory.test.ts
- tests/runner.test.ts

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，47 个测试全部通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `39afe1a0a7393da212fa8c1b1f6c137b62d37f92`
- 暂不执行回滚

### 风险

- 当前 memory 仅为进程内短期记忆，重启后不会保留
- heuristic provider 还未主动利用结构化记忆字段，当前主要通过 `systemPrompt` 生效

### 下一步

- 可继续补记忆摘要压缩与偏好抽取
- 可继续让 heuristic provider 参考最近记忆避免重复动作

## 2026-05-19 / CLI + Browser / 单猫动画、打开链接与更长思维链路

### 版本

- `catnipent 1.0`

### 目标

修复开机动画碎片化，只保留一只猫逐行进入；完善浏览器和搜索链路，让搜索结果可继续打开目标链接；并把默认思维步数提高。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`0d3c6d9`
- 开发前远端备份分支：`backup/pre-single-cat-open-url-20260519-1458`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- 启动动画从重复整屏帧改为单猫逐行进入
- `Welcome to Catnip` 改为只输出一次
- 新增 `open_url`
- `open_url` 仅允许 `http/https` 绝对链接
- Runner 支持从任务文本提取显式 URL
- 搜索后可继续走 `open_url`
- 默认 `CATNIP_RUNNER_MAX_STEPS` 从 `5` 提升到 `10`
- 更新 README、Tool Policy、总进度与分层日志

### 改动部分

- CLI 启动动画：单猫逐行进入
- 浏览器链路：`open_url`
- Runner 预算：默认步数提升到 `10`
- 文档与施工日志同步

### 修改文件

- .env.example
- README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/TOOL_POLICY.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md
- src/bootstrap.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- tests/gateway.test.ts
- tests/guard.test.ts
- tests/runner.test.ts
- tests/tools.test.ts

### 验证结果

- `npm test`：通过，45 个测试全部通过
- `printf '/exit\\n' | node dist/src/main.js --interactive`：通过
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "open url https://example.com/result"`：通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `0d3c6d9`
- 暂不执行回滚

### 风险

- `open_url` 目前只做协议级约束，未加域名白名单
- 更长步数预算会让异常任务跑得更久

### 下一步

- 可继续补域名白名单或浏览器历史能力
- 可继续补关闭启动动画的环境变量

## 2026-05-19 / CLI / 大号粉猫开机图、彩色时间线与主线命名规则

### 版本

- `catnipent 1.0`

### 目标

按用户要求调整 CLI 视觉：去掉 `codex` 痕迹、保留 `catnip`，开机显示更大的粉色小猫和 `Welcome`，并给等待、规划、工具调用加颜色；同时把 GitHub 主线命名规则固化为 `catnipent 1.0` 体系并上传。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`b1af0329b91028dbe429f0f385c5e84076f5519b`
- 开发前远端备份分支：`backup/pre-cat-banner-color-20260519-1442`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- 交互提示符改为 `catnip> `
- 启动 banner 改为更大的粉色小猫
- 启动 banner 增加 `Welcome to Catnip`
- `[queue]` 与 `[wait]` 等等待输出改为粉色
- `[plan]` 规划输出改为黄色
- `[act]` 与 `[done]` 工具调用输出改为绿色
- README 增加彩色时间线说明
- 主文档新增 GitHub 主线命名规则
- 固化当前主线版本名为 `catnipent 1.0`
- 说明后续大改默认沿用 `catnipent 1.x`
- 新增 Gateway banner / prompt 测试

### 改动部分

- CLI 交互提示符与启动猫图
- CLI 时间线颜色
- GitHub 主线命名规则文档

### 修改文件

- README.md
- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts

### 验证结果

- `npm test`：通过，39 个测试全部通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `b1af0329b91028dbe429f0f385c5e84076f5519b`
- 暂不执行回滚

### 风险

- 颜色输出依赖终端支持 ANSI
- 大号 banner 会让交互 CLI 首屏更高

### 下一步

- 可继续补颜色开关
- 可继续补版本号递增自动化

## 2026-05-19 / CLI / 大猫进入动画与上传记录规则

### 版本

- `catnipent 1.0`

### 目标

基于用户提供的大猫 ASCII 图，把交互 CLI 启动改成进入动画；同时强化文档规则，要求以后每次上传 GitHub 都必须标记改动部分，并在 `docs/LOG.md` 里写明本轮版本号。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`cfd48fa`
- 开发前远端备份分支：`backup/pre-cat-banner-color-20260519-1442`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- 启动猫图替换为用户指定的大号猫图
- 启动过程改为逐帧进入动画
- 保留粉色与 `Welcome to Catnip`
- 主文档新增“每次上传都要标记改动部分”规则
- 主文档新增“`docs/LOG.md` 必写版本号”规则
- 进度系统文档同步规则
- Gateway 层日志同步记录进入动画
- 新增启动动画相关测试

### 改动部分

- CLI 启动视觉：大猫 ASCII、进入动画、欢迎语
- 文档规则：GitHub 上传改动标记、日志版本记录
- 测试：启动大猫图与动画帧覆盖

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/README.md
- docs/progress/layers/01-gateway.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts

### 验证结果

- `npm test`：通过，39 个测试全部通过
- `printf '/exit\\n' | node dist/src/main.js --interactive`：通过
- 冒烟确认启动时打印大号粉色猫图、`Welcome to Catnip` 和 `catnip> `

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `cfd48fa`
- 暂不执行回滚

### 风险

- 进入动画会让交互 CLI 启动稍慢一点
- ANSI 控制和彩色输出仍依赖终端支持

### 下一步

- 可继续补关闭动画的环境变量

## 2026-05-19 / Tools / 增加网页搜索与浏览器搜索

### 目标

在现有工具链上继续增加两个正式工具：`web_search` 和 `open_browser_search`，让 Agent 既能程序内搜索外部信息，也能在默认浏览器里直接发起搜索。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`b1af0329b91028dbe429f0f385c5e84076f5519b`
- 开发前远端备份分支：`backup/pre-web-search-tools-20260519-1417`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- Tool Registry 新增 `web_search`
- Tool Registry 新增 `open_browser_search`
- 工具分类新增 `web`
- Executor 新增 `web_search` 执行能力
- `web_search` 通过 DuckDuckGo HTML 拉取搜索页并解析结构化结果
- Executor 新增 `open_browser_search` 执行能力
- `open_browser_search` 只拼搜索 URL 并调用默认浏览器打开
- guard 为 `web_search` 增加 `query` 与 `limit` 校验
- guard 为 `open_browser_search` 增加查询词校验
- Runner heuristic 新增搜索关键词规划
- Runner 新增搜索查询词提取
- DeepSeek tool calling schema 新增 `web_search`
- DeepSeek tool calling schema 新增 `open_browser_search`
- CLI 时间线新增 `web` / `search` 请求与结果摘要
- 更新 README、Tool Policy、总进度和分层日志

### 修改文件

- README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/TOOL_POLICY.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/07-runner.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md
- src/layers/01-gateway/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- src/shared/types/tool.ts
- tests/guard.test.ts
- tests/runner.test.ts
- tests/tools.test.ts

### 验证结果

- `npm test`：通过，37 个测试全部通过
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "web search latest catnip agent runtime and open browser search"`：通过
- 冒烟确认时间线出现 `web_search -> open_browser_search`
- 冒烟确认 `web_search` 返回结果摘要，`open_browser_search` 成功发起浏览器搜索

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `b1af0329b91028dbe429f0f385c5e84076f5519b`
- 暂不执行回滚

### 风险

- `web_search` 当前依赖外部搜索页面结构，后续可能需要适配
- 当前查询词提取仍是规则级，可能保留部分连接词
- `open_browser_search` 只保证发起搜索，不验证浏览器页面最终显示状态

### 下一步

- 可继续补 query rewrite
- 可继续补搜索结果二次读取或摘要
- 可继续补网络超时和搜索失败分类

## 2026-05-19 / Tools / 写完 html 后打开浏览器预览

### 目标

根据施工文档继续推进工具调用层，至少达到模型可以写完 html 文件后直接调用工具打开浏览器预览。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`b1af0329b91028dbe429f0f385c5e84076f5519b`
- 开发前远端备份分支：`backup/pre-browser-open-tool-20260519-1409`
- 当前工作区存在既有未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- Tool Registry 新增 `open_browser`
- `open_browser` 分类为 `browser`
- Executor 新增 `open_browser` 执行能力
- `open_browser` 默认按平台调用浏览器打开命令
- 新增 `CATNIP_BROWSER_OPEN_BIN` 便于测试替换打开命令
- guard 限制 `open_browser` 仅允许 `.html/.htm`
- guard 限制 `open_browser` 仅允许 `workspaces/demo/`
- Runner heuristic 支持 `write_file -> open_browser`
- Runner provider prompt 明确预览产物默认写入 `workspaces/demo`
- DeepSeek tool schema 增加 `open_browser`
- CLI 时间线增加 `open ...` 与 `opened ... via ...` 展示
- 新增/更新 guard、runner、tools 测试
- 更新工具策略与分层进度日志

### 修改文件

- README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/TOOL_POLICY.md
- docs/progress/layers/09-tool-registry.md
- docs/progress/layers/10-executor.md
- src/layers/01-gateway/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/09-tool-registry/wrapper.ts
- src/layers/10-executor/guard.ts
- src/layers/10-executor/tools.ts
- src/shared/types/tool.ts
- tests/guard.test.ts
- tests/runner.test.ts
- tests/tools.test.ts

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，32 个测试全部通过
- `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "create file html and open browser run html"`：通过
- 冒烟确认时间线出现 `write_file -> open_browser`
- 冒烟确认生成文件路径为 `workspaces/demo/generated.html`

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `b1af0329b91028dbe429f0f385c5e84076f5519b`
- 暂不执行回滚

### 风险

- 当前只实现“本地 html 文件预览”，未实现本地静态服务器
- 真实浏览器是否成功显示页面仍依赖宿主机桌面环境
- 早期一次未受限冒烟曾让模型选择根目录 `index.html`；现已通过 `open_browser` guard 和 provider 提示收紧到 `workspaces/demo/`

### 下一步

- 可继续补 `serve_static` 或 `preview_html` 一体化工具
- 可继续补对页面渲染结果的自动验收

## 2026-05-19 / Queue + CLI / 队列动态交互、改动摘要与超时放宽

### 目标

严格按施工文档继续下一步开发，优先补齐队列动态交互、CLI 默认可观测性、文件改动摘要展示，并把默认超时约束放宽到更适合长任务的范围。

### 开工检查

- 当前分支：`feat/cli-handtest`
- 本轮开发前基线提交：`b1af0329b91028dbe429f0f385c5e84076f5519b`
- 当前工作区存在未跟踪文件，已避开，不做覆盖或回滚

### 本次修改

- Queue 增加任务动态观测字段：`updatedAt`、`queueEnteredAt`、`queuePosition`
- Queue 增加 `subscribe`
- Queue 快照增加 `queueDepth`、`pendingCount`
- Queue 在入队、出队、状态变化后刷新等待位置并通知订阅方
- Gateway 接入 Queue 订阅并打印默认 `[queue]`
- Gateway 增加默认 `[wait]` 等待计时线
- Gateway 结果页增加 `queueWaitMs`
- Gateway 结果页增加 `totalDurationMs`
- Gateway 失败结果增加 `failureKind` 和 `error`
- 交互提示符改为 `codex@catnip>`
- `write_file` 工具结果增加 `created`
- `write_file` 工具结果增加 `preview`
- `patch_file` 工具结果增加 `search`
- `patch_file` 工具结果增加 `replace`
- CLI 工具结果格式化直接显示“改了什么”
- Worker 失败结果补 `failureKind=timeout|runtime`
- 默认 `CATNIP_RUN_TIMEOUT_MS` 从 `60000` 调整到 `180000`
- 更新 README、总进度与分层进度日志

### 修改文件

- .env.example
- README.md
- src/bootstrap.ts
- src/layers/01-gateway/types.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/02-queue/types.ts
- src/layers/02-queue/wrapper.ts
- src/layers/03-worker/wrapper.ts
- src/layers/04-harness/wrapper.ts
- src/layers/10-executor/tools.ts
- src/shared/types/runTask.ts
- tests/gateway.test.ts
- tests/queue.test.ts
- tests/tools.test.ts
- tests/worker.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/02-queue.md
- docs/progress/layers/03-worker.md
- docs/progress/layers/04-harness.md

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，27 个测试全部通过
- `node dist/src/main.js "readme and git diff"`：通过
- 冒烟确认默认输出可见 `[queue]`、`[wait]`、`[timer]`
- 冒烟确认结果页可见 `queueWaitMs`、`runDurationMs`、`totalDurationMs`

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 如需回滚，可回到开发前基线提交 `b1af0329b91028dbe429f0f385c5e84076f5519b`
- 暂不执行回滚

### 风险

- 当前 queue wait 计时仍是 CLI 侧观测，不是 Queue 层主动推送的逐秒事件
- Harness 超时仍只中断外层等待，不能真正取消底层 provider 请求
- 多任务下默认输出更密，后续可能需要可折叠或单行刷新模式

### 下一步

- 可继续补 `/interrupt` 或 cancel 语义
- 可继续补更明确的 changed files 汇总
- 可继续补 provider 级真实取消与 timeout 传播

## 2026-05-19 / CLI / 长任务计时心跳

### 目标

给长任务增加可见的计时心跳，避免用户只能看到静默等待，不知道已经跑了多久、是否还有活动。

### 本次修改

- 为活跃 run 增加本地 CLI 计时器
- 周期性输出 `[timer]`
- 输出 `elapsed`
- 输出 `idle`
- 输出 `last`
- run 结束时自动清理计时器
- 更新 README 时间线说明
- 更新 Gateway 测试

### 修改文件

- README.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，24 个测试全部通过
- `CATNIP_RUN_TIMEOUT_MS=12000 CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js "帮我用王小波的风格写一下被掩埋的巨人"`：通过
- 冒烟确认输出 `[timer] task_x elapsed=... idle=... last=...`

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 备份分支已存在：`backup/pre-cli-timer-heartbeat-20260519-130953`
- 暂不执行回滚

### 风险

- 当前计时器只反映 CLI 侧观测到的活跃 run，不是 provider 内部 token 级进度
- 长任务多时，终端输出会更密

### 下一步

- 可补用户可配置计时间隔
- 或补单行刷新式 TUI 状态

## 2026-05-19 / CLI / 运行中补充输入转 follow-up

### 目标

修复交互模式下“任务运行时无法继续输入微调指令”的问题，让运行中的补充文本能够被接收并在当前任务结束后续跑。

### 本次修改

- 将交互模式从阻塞式 `readline/promises.question()` 改为事件驱动 `readline`
- 增加运行中 refinement 捕获
- 增加 `buildInteractiveFollowUpInput`
- 当前任务结束后自动把 refinement 组装成 follow-up 输入
- `/exit` 在有活跃任务时改为等待当前任务结束
- 如果已请求退出，则丢弃尚未执行的 follow-up refinement
- 更新 README 交互说明
- 更新 Gateway 测试

### 修改文件

- README.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，23 个测试全部通过
- `bash -lc '(printf "帮我写被掩埋的巨人的故事\\n"; sleep 2; printf "王小波风\\n"; sleep 1; printf "/exit\\n") | CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js --interactive'`
- 冒烟确认运行中输入 `王小波风` 会被立即打印为 `captured refinement`

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 备份分支已存在：`backup/pre-interactive-followup-20260519-125657`
- 暂不执行回滚

### 风险

- 当前 follow-up 不是中断执行，只是把中途输入变成下一轮任务
- DeepSeek 长任务下，当前轮仍可能超时；follow-up 只是在当前轮结束后接着跑

### 下一步

- 继续做真正的 session history
- 或补 runner 级 interrupt / cancel
- 或补 `/followup` 与 `/interrupt` 明确命令语义

## 2026-05-19 / Worker / 线程池式消费与增强心跳

### 目标

完善等待队列消费侧，让 CLI 多任务不再只依赖单 worker 串行处理；同时补可观测的 worker 池心跳，便于交互手测。

### 本次修改

- 开发前备份分支已推送：`backup/pre-threadpool-heartbeat-20260519-124722`
- 备份基线提交：`c3ca89d6bccf4bebb1d4d0765e57088822529eca`
- 为 Worker 增加 `workerCount`
- 为 Worker 增加 `heartbeatIntervalMs`
- 启动时拉起多个并发消费槽
- `worker.heartbeat` 增加 `workerCount`
- `worker.heartbeat` 增加 `activeWorkers`
- `worker.heartbeat` 增加 `idleWorkers`
- `worker.heartbeat` 增加 `queueDepth`
- `worker.heartbeat` 增加 `completedTasks`
- `worker.heartbeat` 增加 `failedTasks`
- `bootstrap` 增加 `CATNIP_WORKER_COUNT`
- `bootstrap` 增加 `CATNIP_WORKER_HEARTBEAT_MS`
- trace 日志订阅 `worker.heartbeat`
- CLI `--debug` 增加 worker 心跳打印
- 新增 `tests/worker.test.ts`

### 修改文件

- .env.example
- src/bootstrap.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/03-worker/index.ts
- src/layers/03-worker/types.ts
- src/layers/03-worker/wrapper.ts
- src/shared/types/event.ts
- tests/worker.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/03-worker.md

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，22 个测试全部通过
- `CATNIP_WORKER_COUNT=2 CATNIP_CLI_DEBUG=1 node dist/src/main.js --task "readme and git diff" --task "shell status"`：通过
- 调试输出确认可见 `worker.heartbeat active / idle / queue`

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 备份分支已存在，如后续发现问题可回到 `c3ca89d6bccf4bebb1d4d0765e57088822529eca`
- 暂不执行回滚

### 风险

- 当前线程池是 Node 进程内异步消费槽，不是 `worker_threads`
- `--debug` 下心跳输出会增加
- Worker 仍缺少优雅 shutdown

### 下一步

- 继续补 shutdown / cancel
- 或补 backlog 与 starvation 观测
- 或补每个 worker slot 的独立标识

## 2026-05-19 / Docs / 改成开发前先备份、出问题回滚上一版本

### 目标

按用户最新协作偏好修正文档默认规则：每次开发前先上传一个可回退备份；如果后续开发出问题，默认回滚到上一版本，并明确告诉用户测试命令。

### 本次修改

- 修改主文档开工前强制清单
- 修改主文档收尾强制清单
- 修改 GitHub 协作基本原则
- 修改 GitHub 上传前检查项
- 修改 GitHub 回滚顺序
- 明确每次真实开发前必须先上传备份
- 明确回滚后必须告知用户实际复测命令
- 同步更新 `docs/progress/README.md`
- 同步更新 `docs/DEV_PROGRESS.md`

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/progress/README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 本轮为文档修改
- 已人工检查主文档、进度索引与总进度日志规则一致

### 回滚判断

- 本轮仅修改文档
- 不执行回滚

### 风险

- 新规则会增加每轮真实开发前的固定 Git 操作
- 如果工作区本身长期不干净，开发前备份需要先判断如何与用户已有改动共存

### 下一步

- 后续每次真实开发前先做远端备份并记录提交号
- 若后续开发失败，默认回滚到上一版本并在回复中写明测试命令

## 2026-05-19 / CLI / 紧凑时间线输出与多任务编排

### 目标

把 CLI 从“主要依赖 `--debug` 看原始事件”推进到“默认就像 coding agent 一样能看见公开思考、工具动作、命令执行和批量任务编排”。

### 本次修改

- 将 Gateway CLI 参数从单一 `inputText` 扩展为 `tasks`
- 新增 `--task` / `-t`
- 新增 `--tasks-file`
- 支持按行读取任务文件并忽略 `#` 注释
- 新增 `CliEventPrinter`
- 默认输出紧凑时间线标签：`[queue]`、`[run]`、`[stage]`、`[context]`、`[plan]`、`[think]`、`[act]`、`[done]`、`[fail]`、`[answer]`
- 新增批量编排标签：`[orchestrator]`
- 为工具请求和工具结果增加人类可读格式化
- 兼容 Executor `tool.call.result.result.payload` 结构
- 交互模式接入同一套事件打印器
- 更新 `README.md` CLI quick start
- 更新 Gateway 相关测试

### 修改文件

- README.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md

### 验证结果

- `npm run typecheck`：通过
- `npm test`：通过，20 个测试全部通过
- `node dist/src/main.js "readme and git diff"`：通过
- `node dist/src/main.js --task "readme and git diff" --task "shell status"`：通过
- `node dist/src/main.js --debug "readme and git diff"`：通过

### 回滚判断

- 本轮为 CLI 增强与文档同步
- 测试与冒烟均通过
- 暂不执行回滚

### 风险

- 默认输出比过去更密，长任务下仍可能需要折叠或分级
- 批量任务当前是单 worker FIFO 编排，不是并发多 agent
- provider tool-calling 模式的 `plan` 行目前仍可能先显示空计划，再进入真实工具调用

### 下一步

- 继续做 `summary/full` 输出级别
- 或补更像 TUI 的任务面板
- 或在 CLI 上增加更明确的工具输出折叠策略

## 2026-05-19 / Docs / 调整上传与回滚默认规则

### 目标

按用户最新协作偏好修正文档默认规则：每次开发完成后都上传，是否回滚先询问用户。

### 本次修改

- 修改主文档开工前清单
- 修改主文档收尾清单
- 修改 GitHub 上传标准
- 修改回滚标准
- 明确默认自动 push 的条件
- 明确回滚前必须先征求用户确认
- 同步更新 `docs/progress/README.md`
- 同步更新 `docs/DEV_PROGRESS.md`

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/progress/README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 本轮为文档修改
- 已人工检查关键规则段落一致性

### 回滚判断

- 本轮仅调整文档规则
- 不执行回滚

### 下一步

- 后续每轮代码开发在测试通过后默认执行 push
- 如果出现需要撤销的情况，先询问用户再决定是否回滚

## 2026-05-19 / Large Step / 统一 Runner 步数限制、超时与失败恢复

### 目标

把文档里长期挂着的“step 上限、超时与失败恢复”从待办推进为可配置、可测试的真实运行限制。

### 本次修改

- 为 `createRunnerLayer` 增加统一运行限制配置
- 支持 `maxSteps`
- 支持工具失败后按 `maxToolRetries` 重试
- 支持 `continueOnToolError` 控制失败后继续执行后续计划
- 将 DeepSeek provider 的 `stepCountIs(5)` 改为读取 Runner 传入限制
- 为 Harness 增加 run 级超时包装
- 在 run 失败时写入 `run.report`
- 为 `run.finished` 增加 `failureKind` 与 `errorMessage`
- 新增环境变量：`CATNIP_RUNNER_MAX_STEPS`、`CATNIP_RUNNER_MAX_TOOL_RETRIES`、`CATNIP_RUNNER_CONTINUE_ON_TOOL_ERROR`、`CATNIP_RUN_TIMEOUT_MS`
- 新增 Runner 限制测试与 Harness 超时测试

### 修改文件

- .env.example
- src/bootstrap.ts
- src/layers/04-harness/types.ts
- src/layers/04-harness/wrapper.ts
- src/layers/07-runner/provider.ts
- src/layers/07-runner/types.ts
- src/layers/07-runner/wrapper.ts
- src/shared/types/event.ts
- tests/harness.test.ts
- tests/runner.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，19 个测试全部通过

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 运行限制与测试均通过，暂不执行文件级回滚或提交级回滚

### 风险

- provider tool-calling 模式目前依赖模型侧 `stopWhen` 与 Runner 侧预算双重限制，后续还应继续补更细的中止原因
- 当前“失败恢复”仍是最小策略，只支持固定重试次数与是否继续，不含分类重试或补救规划
- 超时后底层异步任务不会被真正取消，只是 run 结果提前失败

### 下一步

- 继续细化失败分类与恢复策略
- 或补 run 级验收结构与更完整的回滚建议

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

## 2026-05-19 / CLI / 增补交互会话命令并修复 EOF 退出

### 目标

继续沿 `01-gateway` 强化 CLI，使交互模式更适合连续手测，并修复管道喂给交互模式时的退出问题。

### 本次修改

- 为交互模式增加 `/history`
- 为交互模式增加 `/last`
- 为交互模式增加 `/clear`
- 新增 `parseInteractiveCommand`
- 抽出 `CliRunResult`
- 抽出 `printRunResult`
- 抽出 `printHistory`
- 在交互模式内维护 session history
- 修复 `readline` 在 stdin EOF 后继续提问导致的 `ERR_USE_AFTER_CLOSE`
- 更新 README 的交互命令说明
- 扩展 Gateway 测试覆盖交互命令解析

### 修改文件

- README.md
- src/layers/01-gateway/wrapper.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，16 个测试全部通过
- `printf 'readme and git diff\n/history\n/clear\n/history\n/exit\n' | node dist/src/main.js --interactive`：通过

### 回滚判断

- 本轮先后遇到两类问题：
- `exactOptionalPropertyTypes` 下的可选字段构造错误
- 交互模式在管道 EOF 后触发 `ERR_USE_AFTER_CLOSE`
- 两类问题都已在当前分支局部修复
- 修复后验证通过，因此不执行文件级回滚或提交级回滚

### 风险

- 交互历史仍是进程内内存数据，重启即丢失
- `/last` 直接重打完整最终回答，长文本下输出仍偏重
- 交互命令仍是轻量文本协议，不支持参数化子命令

### 下一步

- 继续补 CLI 输出分级或历史持久化
- 或回到 Runner 的 step/timeout/recovery 主线

## 2026-05-19 / Debug / CLI 实时调试输出与本地 trace 日志

### 目标

让本地 CLI 手测时不仅能看到最终答案，还能看到 prompt、计划、步骤摘要和工具轨迹，并把这些信息落到单独的本地 trace 日志。

### 本次修改

- Gateway 新增 `--debug`
- 支持 `CATNIP_CLI_DEBUG=1`
- Gateway 订阅调试事件并实时打印
- Harness 发布 `prompt.composed`
- Runner 发布 `agent.plan.generated`
- Runner 发布 `agent.reasoning.summary`
- bootstrap 新增 `logs/catnip-trace.jsonl`
- trace 日志订阅并记录 prompt / plan / reasoning / tool / finalAnswer 事件
- 更新 `.env.example`
- 更新 README 调试说明

### 修改文件

- .env.example
- README.md
- src/bootstrap.ts
- src/layers/01-gateway/types.ts
- src/layers/01-gateway/wrapper.ts
- src/layers/04-harness/wrapper.ts
- src/layers/07-runner/wrapper.ts
- src/shared/types/event.ts
- tests/gateway.test.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/04-harness.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，16 个测试全部通过
- `CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js --debug "readme and git diff"`：通过
- `logs/catnip-trace.jsonl`：确认写入 prompt、reasoning summary、tool request/result、final answer

### 回滚判断

- 本轮先后遇到两类类型问题：
- Gateway 订阅事件时缺少事件字段收窄
- `EventBusEvent` 动态字段读取缺少索引转换
- 两类问题都已在当前分支局部修复
- 修复后验证通过，因此不执行文件级回滚或提交级回滚

### 风险

- 开启 `--debug` 后输出量会明显变大
- trace 日志会记录完整 prompt 和较长工具结果，文件增长会更快
- 当前记录的是公开调试摘要，不是隐藏推理链

### 下一步

- 可继续补调试输出级别
- 或回到 Runner 的超时、步数上限和失败恢复

## 2026-05-19 / Debug / CLI 实时显示当前运行层

### 目标

让用户在命令行调试时不需要自己推断事件归属，直接看到“现在运行到哪一层”，并继续扩大公开可观测过程。

### 本次修改

- Gateway 调试输出增加 layer status line
- `run.started` 显示 `04-harness`
- `run.heartbeat` 显示 `05-context`、`06-skills`、`07-runner`
- `prompt.composed` 显示 `04-harness -> 07-runner`
- `tool.call.requested` 显示 `08-eventbus -> 10-executor`
- `tool.call.result / failed` 显示 `10-executor -> 08-eventbus`
- `agent.step.finished` 显示 `07-runner`
- `run.finished` 显示 `04-harness`
- trace 日志补记 `run.started / run.finished / run.heartbeat / agent.step.finished`
- README 增补 layer status line 说明

### 修改文件

- README.md
- src/bootstrap.ts
- src/layers/01-gateway/wrapper.ts
- docs/DEV_PROGRESS.md
- docs/LOG.md
- docs/progress/layers/01-gateway.md
- docs/progress/layers/07-runner.md

### 验证结果

- `npm run typecheck`：通过
- `npm run build`：通过
- `npm test`：通过，16 个测试全部通过
- `CATNIP_RUNNER_PROVIDER=deepseek node dist/src/main.js --debug "create file workspaces/demo/hello2.html and write a complete minimal html document whose body says 你好世界2"`：通过
- 确认 CLI 实时打印层流转、计划、步骤摘要、工具轨迹与最终答案

### 回滚判断

- 本轮未发生需要回滚的功能性错误
- 仅进行了局部增强与验证
- 因验证通过，不执行文件级回滚或提交级回滚

### 风险

- `--debug` 下输出量继续上升
- 当前仍无法暴露隐藏推理链本身，只能输出公开调试摘要与步骤说明

### 下一步

- 可继续做 `summary/full` 调试级别
- 或补更清晰的 TUI 风格层状态显示

## 2026-05-19 / Docs / 强化日志、GitHub 上传与回滚强制清单

### 目标

把主施工文档从“有规则”进一步强化成“每次都不能忘的强制清单”，减少遗漏日志、遗漏 push、遗漏回滚判断的情况。

### 本次修改

- 在主文档新增“每次开工前强制清单”
- 在主文档新增“每次收尾强制清单”
- 明确同一会话连续开发也必须重新读文档
- 明确每轮代码开发收尾时必须显式检查 GitHub push
- 明确如果没有 push，最终输出必须写原因
- 明确如果已经 push，最终输出必须写分支名和提交号
- 明确回滚后最终输出必须说明回滚内容、原因和复测结果
- 在 `docs/progress/README.md` 增加 GitHub 上传与回滚判断检查要求

### 修改文件

- CODEX_MASTER_REQUIREMENTS.md
- docs/progress/README.md
- docs/DEV_PROGRESS.md
- docs/LOG.md

### 验证结果

- 文档规则已补齐
- 本轮为文档增强，无额外代码测试

### 回滚判断

- 本轮仅修改文档
- 无需执行文件级回滚或提交级回滚

### 风险

- 文档要求更严格后，后续每轮施工会增加一些固定收尾动作

### 下一步

- 后续继续开发时，严格按新增清单执行
