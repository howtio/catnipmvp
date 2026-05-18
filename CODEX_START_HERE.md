# CODEX START HERE：Catnip Agent MVP 施工说明

> 本文档是给 Codex / Coding Agent 读取的第一份施工文档。  
> 目标不是一次性完成完整产品，而是按工程约束搭建一个可运行、可扩展、可观测的 Catnip Agent MVP。

---

## 0. 项目定位

项目名：`catnip-agent`

项目目标：

用 TypeScript + AI SDK 实现一个最小可控 Coding Agent Runtime，用于学习和验证以下能力：

1. Agent Runtime 分层设计
2. Gateway / Queue / Worker 任务流
3. Harness 运行编排
4. Context 构建
5. Skills 与 Tools 分离
6. Runner 受控 ReAct Loop
7. EventBus 工具事件解耦
8. Tool Registry 工具注册
9. Executor 副作用边界
10. JSONL 日志与施工日志记录

核心架构：

```text
Gateway → Queue → Worker → Harness → Context → Skills → Runner → EventBus → Tool Registry → Executor
```

本项目采用“一层一个文件夹、一个 wrapper 对外、一个功能一个文件”的施工方式。

---

## 1. 当前施工目标

当前只做 MVP 骨架和最小可运行链路。

本阶段目标：

```text
Phase 0：项目骨架
Phase 1：Gateway + Queue + Worker
Phase 2：Harness + Context + Skills
Phase 3：Runner + EventBus + Tool Registry + Executor 骨架
Phase 4：接入 AI SDK tool calling
Phase 5：实现最小工具 read_file / list_files / write_file / shell_exec / git_diff
Phase 6：日志、验收、final report
```

本次 Codex 首次施工优先完成：

```text
1. 创建标准目录结构
2. 创建 docs 施工文档
3. 创建 10 层 wrapper.ts / types.ts / index.ts / README.md
4. 创建 shared 公共类型、logger、errors、utils
5. 创建最小 main.ts 和 bootstrap.ts
6. 创建 docs/LOG.md，并追加本次施工记录
```

---

## 2. 非目标

当前阶段禁止实现以下内容：

```text
不做 WebUI
不做 Electron
不做 Docker sandbox
不做 Redis 队列
不做数据库
不做多 Agent
不做长期记忆
不做插件市场
不做远程部署
不做自动 git push
不做 npm publish
不做大规模复杂 Agent 能力
```

MVP 第一版只要求本地 CLI + 内存队列 + 单 Worker + 单 Agent Run。

---

## 3. 十层架构定义

### 第 1 层：Gateway 入口层

路径：

```text
src/layers/01-gateway/
```

职责：

```text
接收用户输入
校验用户输入
创建 RunTask
提交任务到 Queue
```

禁止：

```text
不调用模型
不执行工具
不读写 workspace
不直接调用 Executor
```

---

### 第 2 层：Queue 队列层

路径：

```text
src/layers/02-queue/
```

职责：

```text
任务入队
任务出队
维护任务状态 pending / running / done / failed
MVP 阶段使用内存 FIFO 队列
```

禁止：

```text
不理解任务含义
不调用 Harness
不调用模型
不执行工具
```

---

### 第 3 层：Worker 消费层

路径：

```text
src/layers/03-worker/
```

职责：

```text
从 Queue 消费任务
标记任务 running
调用 Harness 运行任务
捕获错误
标记任务 done / failed
```

禁止：

```text
不构建 prompt
不直接调用模型
不直接执行工具
```

---

### 第 4 层：Harness 运行编排层

路径：

```text
src/layers/04-harness/
```

职责：

```text
创建 runId
管理一次 Agent Run 的生命周期
调用 Context 构建上下文
调用 Skills 注入技能说明
调用 Runner 执行模型循环
结束时执行验收检查
生成 final report
记录 run 级日志
```

禁止：

```text
不直接执行工具
不直接读写业务文件
不写复杂模型推理逻辑
```

---

### 第 5 层：Context 上下文层

路径：

```text
src/layers/05-context/
```

职责：

```text
读取 docs 施工文档
扫描 workspace 摘要
加载 session history，MVP 可先为空
构建 base system prompt
整理当前任务、权限、workspace、可用工具说明
```

禁止：

```text
不修改 workspace
不执行 shell
不调用模型
```

---

### 第 6 层：Skills 技能层

路径：

```text
src/layers/06-skills/
```

职责：

```text
根据用户任务选择相关 SKILL.md
读取 skills/coding/SKILL.md 等技能说明
把技能说明注入 context
```

关键原则：

```text
Skill 是说明书，不是真实工具。
Skill 负责告诉 Agent 什么时候做、怎么做、按什么流程做。
Tool 负责真实执行动作。
```

禁止：

```text
Skills 层不执行文件读写
Skills 层不执行 shell
Skills 层不调用 Executor
```

---

### 第 7 层：Runner 决策层

路径：

```text
src/layers/07-runner/
```

职责：

```text
调用 AI SDK
执行受控 ReAct Loop
让模型决定是否调用工具
把工具调用转换成 EventBus 事件
等待工具结果
把工具结果返回给模型
输出最终回答
```

关键约束：

```text
Runner 不直接执行工具。
Runner 不直接读写文件。
Runner 不直接执行 shell。
Runner 只能通过 EventBus 发起 tool.call.requested。
```

后续实现方向：

```text
使用 AI SDK generateText
使用 tools 暴露结构化工具
使用 stopWhen / stepCountIs 控制最大 step 数
使用 onStepFinish 记录模型 step、tool call、usage
```

---

### 第 8 层：EventBus 事件层

路径：

```text
src/layers/08-eventbus/
```

职责：

```text
传递 run.started / run.finished
传递 agent.step.finished
传递 tool.call.requested
传递 tool.call.result
传递 tool.call.failed
提供 waitForToolResult
允许 Logger 旁路订阅所有事件
```

MVP 实现：

```text
使用 Node.js EventEmitter
不引入 Redis / Kafka / MQ
```

---

### 第 9 层：Tool Registry 工具注册层

路径：

```text
src/layers/09-tool-registry/
```

职责：

```text
注册工具定义
解析工具名称
校验工具 schema
声明工具所需权限
返回工具 definition
```

关键原则：

```text
Tool Registry 只说明“工具是什么”。
Executor 才负责“工具怎么执行”。
```

禁止：

```text
不直接读写文件
不执行 shell
不绕过 Executor
```

---

### 第 10 层：Executor 执行层

路径：

```text
src/layers/10-executor/
```

职责：

```text
监听 tool.call.requested
通过 Tool Registry 解析工具
执行 permissionGuard
执行 pathGuard
执行 commandGuard
真正执行工具
发布 tool.call.result 或 tool.call.failed
记录审计日志
```

关键原则：

```text
Executor 是唯一副作用边界。
所有读文件、写文件、patch、shell 执行，只能发生在 Executor。
```

---

## 4. 标准目录结构

请按以下结构创建项目：

```text
catnip-agent/
  package.json
  tsconfig.json
  .env.example
  README.md

  src/
    main.ts
    bootstrap.ts

    layers/
      01-gateway/
        wrapper.ts
        types.ts
        index.ts
        README.md
        cliGateway.ts
        parseCliArgs.ts
        createRunTask.ts
        validateUserInput.ts

      02-queue/
        wrapper.ts
        types.ts
        index.ts
        README.md
        inMemoryQueue.ts
        enqueueTask.ts
        dequeueTask.ts
        taskStatusStore.ts

      03-worker/
        wrapper.ts
        types.ts
        index.ts
        README.md
        runWorkerLoop.ts
        processRunTask.ts
        markTaskStatus.ts
        handleWorkerError.ts

      04-harness/
        wrapper.ts
        types.ts
        index.ts
        README.md
        createRun.ts
        runLifecycle.ts
        maxStepPolicy.ts
        acceptanceCheck.ts
        buildFinalReport.ts
        safeGitDiff.ts

      05-context/
        wrapper.ts
        types.ts
        index.ts
        README.md
        buildContext.ts
        loadDocs.ts
        scanWorkspace.ts
        loadSessionHistory.ts
        summarizeWorkspace.ts
        buildBaseSystemPrompt.ts

      06-skills/
        wrapper.ts
        types.ts
        index.ts
        README.md
        skillRegistry.ts
        selectSkills.ts
        loadSkillMarkdown.ts
        injectSkills.ts
        skillMatcher.ts

      07-runner/
        wrapper.ts
        types.ts
        index.ts
        README.md
        agentRunner.ts
        buildAiTools.ts
        runAiSdkGenerateText.ts
        handleStepFinish.ts
        normalizeRunnerResult.ts

      08-eventbus/
        wrapper.ts
        types.ts
        index.ts
        README.md
        eventBus.ts
        publishEvent.ts
        subscribeEvent.ts
        waitForToolResult.ts
        toolCallRouter.ts
        eventTypes.ts

      09-tool-registry/
        wrapper.ts
        types.ts
        index.ts
        README.md
        toolRegistry.ts
        registerTools.ts
        resolveTool.ts
        validateToolSchema.ts
        listAvailableTools.ts
        tools/
          listFiles.definition.ts
          readFile.definition.ts
          writeFile.definition.ts
          patchFile.definition.ts
          shellExec.definition.ts
          gitDiff.definition.ts

      10-executor/
        wrapper.ts
        types.ts
        index.ts
        README.md
        executeTool.ts
        executeResolvedTool.ts
        auditToolCall.ts
        handleToolError.ts
        policy/
          permissionGuard.ts
          pathGuard.ts
          commandGuard.ts
        tools/
          listFiles.exec.ts
          readFile.exec.ts
          writeFile.exec.ts
          patchFile.exec.ts
          shellExec.exec.ts
          gitDiff.exec.ts

    shared/
      types/
        runTask.ts
        permission.ts
        tool.ts
        event.ts
        result.ts
      logger/
        jsonlLogger.ts
        consoleLogger.ts
        logEvent.ts
      errors/
        CatnipError.ts
        PolicyError.ts
        ToolError.ts
        TimeoutError.ts
      utils/
        sleep.ts
        createId.ts
        safeJson.ts
        assertNever.ts

  skills/
    coding/
      SKILL.md
    testing/
      SKILL.md
    debugging/
      SKILL.md
    refactor/
      SKILL.md
    review/
      SKILL.md

  docs/
    ARCHITECTURE.md
    CONSTRUCTION_PLAN.md
    LOG.md
    LAYER_CONTRACT.md
    TOOL_POLICY.md
    AGENT_LOOP.md
    DEBUG_GUIDE.md

  workspaces/
    demo/

  logs/
    .gitkeep

  tests/
    pathGuard.test.ts
    commandGuard.test.ts
    queue.test.ts
```

---

## 5. 分层调用规则

必须遵守调用顺序：

```text
Gateway → Queue → Worker → Harness → Context → Skills → Runner → EventBus → Tool Registry → Executor
```

### Import 规则

```text
1. 每层只能通过 index.ts 暴露 wrapper 和 types。
2. 跨层调用只能 import 对方 index.ts。
3. 不允许跨层 import 对方内部功能文件。
4. 不允许 Runner import Executor。
5. 不允许 Runner import Tool implementation。
6. 不允许 Skills import Executor。
7. 不允许 Context 写文件或执行 shell。
8. 不允许 Gateway 直接调用 Runner。
9. 不允许 Worker 直接调用 Runner。
10. Executor 是唯一允许产生副作用的层。
```

---

## 6. wrapper.ts 标准

每层必须有 `wrapper.ts`。

`wrapper.ts` 是该层唯一对外入口。

标准格式：

```ts
export function createXxxLayer(deps: XxxLayerDeps): XxxLayerApi {
  return {
    async someAction(input) {
      // 1. 校验输入
      // 2. 调用本层功能文件
      // 3. 调用下一层 wrapper
      // 4. 返回标准结果
    },
  };
}
```

禁止把所有逻辑写进 `wrapper.ts`。

`wrapper.ts` 只负责组合，不负责堆积业务细节。

---

## 7. bootstrap.ts 依赖组装规则

所有层的依赖必须在 `src/bootstrap.ts` 组装。

禁止在某个层内部随意 new 其他层。

推荐结构：

```ts
export function bootstrapCatnipAgent() {
  const eventbus = createEventBusLayer();

  const toolRegistry = createToolRegistryLayer();

  const executor = createExecutorLayer({
    eventbus,
    toolRegistry,
  });

  const runner = createRunnerLayer({
    eventbus,
  });

  const skills = createSkillsLayer();

  const context = createContextLayer();

  const harness = createHarnessLayer({
    context,
    skills,
    runner,
  });

  const queue = createQueueLayer();

  const worker = createWorkerLayer({
    queue,
    harness,
  });

  const gateway = createGatewayLayer({
    queue,
  });

  return {
    gateway,
    queue,
    worker,
    harness,
    context,
    skills,
    runner,
    eventbus,
    toolRegistry,
    executor,
  };
}
```

---

## 8. main.ts 启动规则

`src/main.ts` 只负责启动。

推荐结构：

```ts
async function main() {
  const app = bootstrapCatnipAgent();

  app.executor.start();
  app.worker.start();

  await app.gateway.startCli();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

---

## 9. Tool 与 Skill 分离规则

### Tool 是真实能力

例如：

```text
list_files
read_file
write_file
patch_file
shell_exec
git_diff
```

Tool 关注：

```text
输入 schema
输出格式
所需权限
真实执行
错误处理
审计日志
```

### Skill 是施工方法

例如：

```text
coding skill
testing skill
debugging skill
refactor skill
review skill
```

Skill 关注：

```text
什么时候使用
先做什么
后做什么
推荐使用哪些工具
禁止哪些行为
最终输出什么格式
```

### 关键原则

```text
Skill 是说明书。
Tool 是工具箱。
Runner 根据 Skill 的指导选择 Tool。
Executor 负责真正执行 Tool。
```

---

## 10. 初始 Skills 文件要求

### skills/coding/SKILL.md

必须包含：

```markdown
# Coding Skill

## When to use

当用户要求新增功能、修改代码、创建文件、实现函数时使用。

## Process

1. 先理解任务范围。
2. 先 list_files 查看项目结构。
3. 再 read_file 查看相关文件。
4. 不允许未读文件直接修改。
5. 只做最小必要修改。
6. 修改后查看 git_diff。
7. 输出修改摘要、风险、回滚方式。

## Recommended tools

- list_files
- read_file
- write_file
- patch_file
- git_diff

## Forbidden behavior

- 不允许修改 workspace 外文件。
- 不允许大范围重构。
- 不允许修改无关文件。
- 不允许编造不存在的文件内容。
```

### skills/testing/SKILL.md

必须包含：

```markdown
# Testing Skill

## When to use

当用户要求写测试、修复测试、运行测试、验证功能时使用。

## Process

1. 先读取 package.json。
2. 判断包管理器和测试框架。
3. 查看已有 tests 或 src 目录。
4. 按项目原有风格创建测试文件。
5. 修改后运行测试命令。
6. 如果测试失败，读取错误输出并修复。
7. 最后查看 git_diff。
8. 输出测试结果、修改文件、风险、回滚方式。

## Recommended tools

- list_files
- read_file
- write_file
- patch_file
- shell_exec
- git_diff

## Forbidden behavior

- 不允许编造测试结果。
- 不允许没看 package.json 就猜测试命令。
- 不允许修改 workspace 外文件。
- 不允许为了通过测试删除核心逻辑。
```

---

## 11. Tool Policy

权限等级：

```text
low:
- allow: list_files, read_file
- deny: write_file, patch_file, shell_exec

medium:
- allow: list_files, read_file, write_file, patch_file, git_diff
- shell_exec 只允许：
  - npm test
  - npm run test
  - npm run build
  - pnpm test
  - pnpm build
  - git status
  - git diff
  - ls
  - cat

high:
- allow: medium 全部
- 可扩展 npm install / pnpm install
- 仍然禁止危险命令
```

始终禁止：

```text
rm
rm -rf
sudo
chmod
chown
curl
wget
ssh
scp
git push
npm publish
docker
powershell
```

---

## 12. EventBus 事件定义

MVP 必须至少支持以下事件：

```ts
type CatnipEvent =
  | {
      type: "run.started";
      runId: string;
      taskId: string;
      sessionId: string;
    }
  | {
      type: "run.finished";
      runId: string;
      success: boolean;
    }
  | {
      type: "agent.step.finished";
      runId: string;
      stepNumber: number;
      usage?: unknown;
    }
  | {
      type: "tool.call.requested";
      runId: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      workspaceRoot: string;
      permission: "low" | "medium" | "high";
    }
  | {
      type: "tool.call.result";
      runId: string;
      toolCallId: string;
      ok: true;
      result: unknown;
    }
  | {
      type: "tool.call.failed";
      runId: string;
      toolCallId: string;
      ok: false;
      error: string;
    };
```

---

## 13. 日志规则

必须实现 JSONL 日志：

```text
logs/catnip.jsonl
```

每一行一个 JSON 对象。

建议字段：

```json
{
  "ts": "2026-05-18T00:00:00.000Z",
  "event": "tool.call.requested",
  "runId": "run_xxx",
  "taskId": "task_xxx",
  "sessionId": "session_xxx"
}
```

EventBus 的所有事件都应该被 logger 旁路订阅并写入 JSONL。

---

## 14. docs/LOG.md 施工日志规则

每次施工必须追加 `docs/LOG.md`。

禁止覆盖旧日志。

模板：

```markdown
## YYYY-MM-DD / Phase X / 标题

### 目标

本次施工目标。

### 本次修改

- 修改点 1
- 修改点 2

### 修改文件

- file1
- file2

### 验证结果

- npm install：成功 / 未执行
- npm run typecheck：成功 / 未执行
- npm test：成功 / 未执行

### 风险

- 风险 1
- 风险 2

### 下一步

下一步计划。
```

---

## 15. docs/CONSTRUCTION_PLAN.md 要求

必须创建施工计划文件，至少包含：

```text
当前目标
非目标
Phase 0：项目骨架
Phase 1：Gateway + Queue + Worker
Phase 2：Harness + Context + Skills
Phase 3：Runner + EventBus
Phase 4：Tool Registry + Executor
Phase 5：Policy Guard + Tools
Phase 6：Final Report + Logs
每个 Phase 的验收标准
```

---

## 16. docs/LAYER_CONTRACT.md 要求

必须创建层契约文件，至少包含：

```text
十层调用顺序
每层职责
每层禁止事项
跨层 import 规则
副作用边界
Runner 与 Executor 隔离规则
Skills 与 Tools 分离规则
```

---

## 17. MVP 验收任务

最终 MVP 应该能完成：

```text
请在 workspace/demo 中创建 src/add.ts，
实现 add(a, b) 函数，
再创建测试文件，
运行测试，
最后输出修改摘要、测试结果、风险和回滚方案。
```

合格流程必须是：

```text
Gateway 创建任务
Queue 入队
Worker 消费
Harness 创建 run
Context 构建上下文
Skills 注入 coding/testing skill
Runner 调模型
Runner 通过 EventBus 请求 list_files
Executor 执行 list_files
Runner 通过 EventBus 请求 read_file
Executor 执行 read_file
Runner 通过 EventBus 请求 write_file
Executor 执行 write_file
Runner 通过 EventBus 请求 shell_exec
Executor 执行 npm test
Harness 强制 git_diff
Harness 输出 final report
Worker 标记 done
```

---

## 18. 首次施工任务

Codex 请从这里开始。

### Task：Phase 0 项目骨架

请完成以下内容：

```text
1. 初始化 TypeScript 项目基础文件
2. 创建 src/main.ts
3. 创建 src/bootstrap.ts
4. 创建 src/layers/01-gateway 到 src/layers/10-executor
5. 每层创建 wrapper.ts / types.ts / index.ts / README.md
6. 创建 shared/types、shared/logger、shared/errors、shared/utils
7. 创建 skills/coding/SKILL.md
8. 创建 skills/testing/SKILL.md
9. 创建 docs/ARCHITECTURE.md
10. 创建 docs/CONSTRUCTION_PLAN.md
11. 创建 docs/LOG.md
12. 创建 docs/LAYER_CONTRACT.md
13. 创建 docs/TOOL_POLICY.md
14. 创建 docs/AGENT_LOOP.md
15. 创建 docs/DEBUG_GUIDE.md
16. 创建 logs/.gitkeep
17. 创建 workspaces/demo/
18. 在 docs/LOG.md 追加本次施工记录
```

### Phase 0 验收标准

```text
1. 目录结构符合本文档要求。
2. 每一层都有 wrapper.ts / types.ts / index.ts / README.md。
3. docs/LOG.md 已追加施工记录。
4. docs/CONSTRUCTION_PLAN.md 已包含 Phase 规划。
5. docs/LAYER_CONTRACT.md 已包含跨层调用规则。
6. npm run typecheck 可以执行。
```

---

## 19. 编码风格要求

```text
1. 使用 TypeScript。
2. 尽量使用明确类型，避免 any。
3. 一个文件只做一个功能。
4. wrapper.ts 只做组合，不堆业务细节。
5. 跨层只通过 index.ts 或 wrapper API 调用。
6. 错误使用自定义 Error 类型。
7. 所有异步函数要有明确返回值。
8. 所有路径操作后续必须经过 pathGuard。
9. 所有 shell 命令后续必须经过 commandGuard。
10. 所有工具调用后续必须记录 audit log。
```

---

## 20. 最重要的工程原则

```text
Gateway 接单。
Queue 排队。
Worker 消费。
Harness 管 run。
Context 准备施工资料。
Skills 提供施工方法。
Runner 做模型决策。
EventBus 传工具事件。
Tool Registry 管工具定义。
Executor 执行真实工具。

Skills 不执行。
Tools 不决策。
Runner 不碰副作用。
Executor 不做推理。
```

---

## 21. Codex 输出要求

每次施工结束后，必须输出：

```text
1. 本次完成了什么
2. 修改了哪些文件
3. 如何运行
4. 如何验证
5. 当前风险
6. 下一步建议
```

并且必须更新：

```text
docs/LOG.md
```

---

## 22. 当前开始指令

请开始执行：

```text
Phase 0：项目骨架施工
```

不要实现复杂功能。  
不要跳到 AI SDK 接入。  
不要实现真实工具执行。  
先把架构、目录、文档、类型骨架搭好。
