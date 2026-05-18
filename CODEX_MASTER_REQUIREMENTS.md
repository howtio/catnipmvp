# Catnip Agent 总工程需求与施工主指令

> 本文件是 Catnip 项目的最高优先级开发指令。  
> 以后无论在哪个设备、由哪个 Codex 接手，默认都必须先读本文件，再决定开发动作。  
> 如果其他文档和本文件冲突，以本文件为准。

---

## 1. 文档定位

本文件同时承担以下角色：

- 总需求文档
- 总施工指令文档
- 阶段推进文档
- 接力开发规则文档
- 进度记录索引文档

目标是让新的 Codex 在任何时刻接手时，都能快速知道：

1. 项目现在做到哪一步
2. 下一步应该做什么
3. 每一层允许做什么、不允许做什么
4. 当前进度应该写到哪里
5. 完成后必须更新哪些文档

---

## 2. 最高优先级规则

每个新的 Codex 开工前必须按顺序读取：

1. `CODEX_MASTER_REQUIREMENTS.md`
2. `docs/DEV_PROGRESS.md`
3. `docs/LOG.md`
4. 与当前任务相关的层级进度日志

默认规则：

- 不允许跳过主文档直接开始写代码
- 不允许不看进度日志就继续开发
- 不允许做完开发后不更新进度文档
- 不允许越过当前 Phase 乱做后续功能

---

## 3. 项目目标

项目名：`catnip-agent`

目标：构建一个本地运行、可控、可扩展、可观测的 Coding Agent Runtime。

核心架构：

```text
Gateway -> Queue -> Worker -> Harness -> Context -> Skills -> Runner -> EventBus -> Tool Registry -> Executor
```

---

## 4. 核心工程原则

```text
Gateway 接单
Queue 排队
Worker 消费
Harness 管 run
Context 准备资料
Skills 提供方法
Runner 做决策
EventBus 传事件
Tool Registry 管工具定义
Executor 执行副作用
```

严格原则：

- Skills 不执行
- Tools 不决策
- Runner 不碰副作用
- Executor 不做推理

---

## 5. 当前产品边界

当前只做本地 CLI Agent MVP。

当前禁止：

- WebUI
- Electron
- Docker sandbox
- Redis
- 数据库
- 多 Agent
- 长期记忆
- 远程部署
- 未经用户明确要求自动 `git push`
- 发布到 npm

---

## 6. 十层职责总表

### 01 Gateway

职责：

- 接收用户输入
- 校验输入
- 创建任务
- 提交 Queue

禁止：

- 不调用模型
- 不执行工具
- 不读写 workspace

### 02 Queue

职责：

- 入队
- 出队
- 维护任务状态
- 管理待处理任务顺序

禁止：

- 不消费任务
- 不管理线程池
- 不调用 Harness
- 不理解任务语义

### 03 Worker

职责：

- 从 Queue 拉取任务
- 控制并发消费
- 运行 worker loop
- 维护 worker 心跳
- 触发 Harness

禁止：

- 不构建 prompt
- 不直接执行工具
- 不直接调用模型

### 04 Harness

职责：

- 创建 runId
- 管理 run 生命周期
- 调用 Context / Skills / Runner
- 验收
- 产出 final report

### 05 Context

职责：

- 读取文档
- 扫描 workspace 摘要
- 构建系统上下文

### 06 Skills

职责：

- 选择 Skill
- 读取 Skill 文本
- 注入方法说明

### 07 Runner

职责：

- 驱动模型循环
- 决策是否调用工具
- 后续接入 DeepSeek provider

### 08 EventBus

职责：

- 传递 run / step / tool / heartbeat 事件

### 09 Tool Registry

职责：

- 注册工具定义
- 返回工具 schema 和权限说明

### 10 Executor

职责：

- 监听工具调用事件
- 做 guard
- 执行真实副作用

---

## 7. 线程池放在哪一层

结论：线程池不应放在 Queue 层，应放在 Worker 层。

原因：

- Queue 的职责是“存任务、取任务、维护状态”
- Worker 的职责才是“消费任务、控制并发、调度执行”
- 线程池属于消费调度能力，不属于排队能力

因此后续设计规则固定为：

- Queue 只维护 FIFO 队列和任务状态
- Worker 持有并发配置，例如 `workerCount`、`maxConcurrentRuns`
- 如果后续引入真正线程池、协程池或工作池，归属 `03-worker`

禁止：

- 不允许在 Queue 层实现线程池
- 不允许 Queue 决定执行并发数

---

## 8. 心跳放在哪一层

结论：心跳的“生产者”应主要放在 Worker 层，心跳的“事件传播”放在 EventBus 层，心跳的“run 级检查”可由 Harness 读取。

推荐拆分：

### Worker 心跳

放在 `03-worker`

用途：

- 标记 worker 是否存活
- 记录 worker 最近一次轮询时间
- 标记 worker 当前是否忙碌

### Run 心跳

由 `04-harness` 感知 run 生命周期阶段

用途：

- 判断一次 run 是否长时间无进展
- 给后续超时控制提供依据

### 心跳事件传播

由 `08-eventbus` 负责

用途：

- 发布 `worker.heartbeat`
- 发布 `run.heartbeat`
- 让 logger 旁路订阅

明确规则：

- Queue 不生成心跳
- Runner 不负责系统心跳
- Executor 不负责 worker 心跳

---

## 9. DeepSeek 接入原则

你已经明确后面想调用 DeepSeek。

因此现在先定原则：

- DeepSeek 只接到 `07-runner`
- 不允许把 DeepSeek 逻辑散落到其他层
- 必须先抽象 provider adapter，再接具体模型
- Context、Skills、Harness、Executor 必须保持模型无关

后续建议顺序：

1. 先做 Runner 对外接口
2. 再做 provider adapter
3. 最后接入 DeepSeek

### DeepSeek 密钥安全规则

DeepSeek API Key 只能通过本地环境变量或本地私有配置注入。

固定规则：

- 不允许把真实 API Key 明文写入仓库
- 不允许把真实 API Key 写入 `CODEX_MASTER_REQUIREMENTS.md`
- 不允许把真实 API Key 写入 `docs/`
- 不允许把真实 API Key 提交到 git 历史
- 只允许在本地未跟踪文件中使用，例如 `.env.local`
- 仓库内只允许出现占位名，例如 `DEEPSEEK_API_KEY=your_key_here`

当前安全判断：

- 用户曾在会话中直接提供过一把 DeepSeek Key
- 该密钥应视为已经暴露
- 后续投入真实开发前，建议先去 DeepSeek 平台轮换该密钥

推荐落地方式：

1. 本地保存 `.env.local`
2. 仓库只提交 `.env.example`
3. 运行时只从环境变量读取 `DEEPSEEK_API_KEY`
4. 在日志中禁止打印完整 key

Runner 接入规范：

- `07-runner` 读取 `DEEPSEEK_API_KEY`
- 如果缺失，Runner 返回明确配置错误
- 任何日志只允许记录 key 是否存在，不允许记录 key 值

---

## 10. 施工阶段总计划

### Phase 0

目录、文档、进度体系

### Phase 1

Gateway + Queue + Worker 骨架

重点：

- 任务对象
- FIFO 队列
- Worker loop
- Worker 并发位
- Worker 心跳骨架

### Phase 2

Harness + Context + Skills

重点：

- run 生命周期
- 文档装载
- workspace 摘要
- skill 注入
- run 心跳感知

### Phase 3

Runner + EventBus 骨架

重点：

- 受控 ReAct Loop 骨架
- step 控制
- 工具请求事件
- heartbeat 事件

### Phase 4

Tool Registry + Executor 骨架

重点：

- tool definition
- guard 边界
- 副作用隔离

### Phase 5

最小工具集

重点：

- `list_files`
- `read_file`
- `write_file`
- `patch_file`
- `shell_exec`
- `git_diff`

### Phase 6

DeepSeek 接入

重点：

- provider adapter
- Runner 接入 DeepSeek
- 基础 tool calling 流程打通

### Phase 7

日志、验收、final report

重点：

- JSONL 日志
- 施工日志
- 验收链路
- demo 流程跑通

---

## 11. 每次开发必须更新哪里

### 总进度

必须更新：

- `docs/DEV_PROGRESS.md`

用途：

- 记录今天总体做到哪一步
- 记录当前进行中、已完成、未开始

### 施工日志

必须更新：

- `docs/LOG.md`

用途：

- 记录每一轮施工的目标、修改、验证、风险、下一步

### 分层进度

必须更新对应层日志：

- `docs/progress/layers/01-gateway.md`
- `docs/progress/layers/02-queue.md`
- `docs/progress/layers/03-worker.md`
- `docs/progress/layers/04-harness.md`
- `docs/progress/layers/05-context.md`
- `docs/progress/layers/06-skills.md`
- `docs/progress/layers/07-runner.md`
- `docs/progress/layers/08-eventbus.md`
- `docs/progress/layers/09-tool-registry.md`
- `docs/progress/layers/10-executor.md`

规则：

- 只要某一层发生开发，就必须追加该层日志
- 不允许覆盖旧记录
- 必须记录当前层做到哪一步、还缺什么、下一步做什么

---

## 12. 每层进度日志模板

每次追加使用以下结构：

```markdown
## YYYY-MM-DD / Phase X / 标题

### 当前目标

本次在本层要完成什么。

### 本次完成

- 完成项 1
- 完成项 2

### 当前状态

- 已完成
- 进行中
- 未完成

### 风险与阻塞

- 风险 1
- 阻塞 1

### 下一步

- 下一步 1
- 下一步 2
```

---

## 13. 新 Codex 接力规则

新的 Codex 接手时必须执行：

1. 先阅读主文档
2. 再阅读总进度
3. 再阅读施工日志
4. 再阅读当前要开发层的进度日志
5. 再决定是否开始实现

接手时必须先回答清楚：

1. 当前 Phase 是什么
2. 上一位 Codex 做到了哪里
3. 这一轮只做哪一层或哪几个文件
4. 做完后准备更新哪些日志

---

## 14. 当前明确决策

本轮已经确定：

1. `CODEX_MASTER_REQUIREMENTS.md` 是最高优先级总指令
2. 线程池归属 `03-worker`
3. 心跳主归属 `03-worker`，传播归属 `08-eventbus`，run 级观测归属 `04-harness`
4. 每层开发必须追加本层进度日志
5. 后续模型默认优先考虑接入 DeepSeek，但当前不提前实现

---

## 15. 当前下一步

当前建议的下一步开发顺序：

1. 初始化 TypeScript 基础文件
2. 补齐十层 `wrapper.ts / types.ts / index.ts` 空骨架
3. 固化 `.env.example`、`.gitignore` 和安全占位规则
4. 再开始 Phase 1 的 Queue 与 Worker 骨架实现

在进入代码实现前，先以本文件为准继续完善文档和进度体系。

---

## 16. 代码完成后的测试规则

以后进入代码开发阶段后，每次完成一轮代码修改，必须执行“先自检，再测试，再记录”的流程。

固定顺序：

1. 先确认本轮修改范围
2. 先检查受影响文件是否符合当前 Phase 目标
3. 再运行最小必要测试
4. 记录测试结果
5. 如果测试失败，先定位问题，再修复，再重测
6. 测试通过后再更新进度文档

### 最小测试原则

- 小改动先跑最小相关测试
- 跨层改动再跑更大范围测试
- 不允许一上来就盲目全量测试
- 不允许未测试就声称完成

### 测试执行顺序

后续默认按以下顺序执行：

1. `typecheck`
2. 受影响单元测试
3. 受影响集成测试
4. 必要时再跑完整测试集

### 当前推荐测试层级

当前仓库在本阶段的已固化脚本为：

1. `npm run typecheck`
2. `npm run build`

当前说明：

- `test` 命令尚未标准化
- 在测试框架和 `package.json` 测试脚本落地前，测试状态应记录为“未定义”或“未执行”
- 不允许把默认 `npm test` 当作已经确认的项目标准

### 分阶段测试标准

#### 文档阶段

- 检查目录结构是否符合主文档
- 检查必需文档是否存在
- 检查日志是否已追加

#### 骨架阶段

- `typecheck` 必须通过
- 入口文件与导出关系必须可解析
- 不允许出现循环 import

#### 工具阶段

- 先测单个工具
- 再测 EventBus 与 Executor 联动
- 再测最小端到端流程

#### DeepSeek 接入阶段

- 先测 provider 初始化
- 再测无 key 时的报错
- 再测单轮调用
- 最后测 tool calling 链路

### 测试失败处理标准

- 先记录失败命令
- 先记录失败输出摘要
- 判断是修复还是回滚
- 修复后必须重跑同一测试
- 涉及跨层修改时，重跑至少一轮更高一级测试

### 测试结果必须记录的位置

每次代码测试后，必须至少更新：

- `docs/LOG.md`
- `docs/DEV_PROGRESS.md`
- 当前开发层的进度日志

记录内容至少包括：

- 本次执行了什么测试
- 成功还是失败
- 如果失败，失败点是什么
- 是否已经修复并重测

### 禁止事项

- 不允许编造测试结果
- 不允许未查看项目脚本就猜测试命令
- 不允许测试失败后不记录风险
- 不允许把“未测试”写成“已验证”

---

## 17. GitHub 仓库协作与回滚规则

如果后续你提供 GitHub 仓库，本项目默认采用“先开发、再测试、必要时回滚”的协作方式。

### 基本原则

- 每一轮开发前先看当前 git 状态
- 每一轮测试前先确认改动范围
- 每一轮测试失败后先判断是修复还是回滚
- 不允许直接破坏用户已有未确认修改

### 回滚原则

回滚分三类：

1. 文件级回滚
2. 本轮提交级回滚
3. 分支级回滚

默认优先级：

1. 优先最小范围回滚
2. 只回滚本轮造成的问题
3. 不回滚用户已有修改

### 回滚触发条件

满足以下情况时，应优先考虑回滚或局部撤销：

- 本轮改动导致测试明显退化
- 修复成本高于本轮收益
- 变更污染了不相关层
- 架构边界被破坏
- 当前分支已经偏离本轮目标

### 回滚前必须确认

- 哪些文件是本轮改动
- 哪些文件是历史已有改动
- 回滚是否会误伤用户变更
- 回滚后是否需要重新测试

### GitHub 协作建议

更稳妥的方式是：

1. 在单独开发分支工作
2. 每轮开发后先本地测试
3. 测试通过再形成提交
4. 如果失败，优先在当前分支修复或回滚

### 当前仓库上传标准

默认上传规则：

- 文档改动可在用户明确同意时直接推送
- 代码改动默认优先走功能分支
- 未经测试通过，不允许上传代码实现
- 未更新日志，不允许上传

### 当前仓库分支策略

当前仓库默认策略固定为：

1. 文档类改动：在用户明确要求时可直接推送 `main`
2. 代码类改动：默认应创建功能分支，例如 `feat/phase-1-queue-worker`
3. 涉及结构性重构：默认不得直推 `main`
4. 除非用户明确同意，否则不自动 push

当前例外：

- 目前仓库仍处于骨架搭建期
- 经过用户明确同意，当前这轮骨架与文档施工可直接在 `main` 推进

代码上传前必须确认：

1. `git status` 干净或仅包含本轮改动
2. 已完成最小必要测试
3. 已更新 `docs/LOG.md`
4. 已更新 `docs/DEV_PROGRESS.md`
5. 已更新相关层级进度日志

代码上传提交说明至少要表达：

- 改动目的
- 改动范围
- 是否包含测试
- 是否可能影响回滚

### 当前仓库回滚标准

回滚必须优先保护以下目标：

1. 保住用户已有修改
2. 保住最近稳定提交
3. 保住日志可追溯性

默认回滚顺序：

1. 先回滚文件级改动
2. 再考虑回滚本轮提交
3. 最后才考虑回退分支到稳定点

回滚后必须执行：

1. `git status`
2. 最小必要测试
3. 更新 `docs/LOG.md`
4. 更新对应层进度日志

禁止事项：

- 不允许为省事直接硬重置用户未确认的改动
- 不允许回滚后不补日志
- 不允许回滚后不复测

---

## 18. 调试标准

每次进入调试阶段时，必须先明确“调试对象、观察点、退出条件”。

### 调试前必须写清楚

1. 当前故障现象
2. 复现步骤
3. 预期行为
4. 实际行为
5. 怀疑位于哪一层

### 调试顺序

1. 先确认是否能稳定复现
2. 再缩小到具体层
3. 再缩小到具体文件
4. 再缩小到具体输入、事件、状态或命令

### 调试记录标准

必须记录：

- 复现命令
- 输入参数
- 关键日志片段
- 结论
- 是否已修复

### 调试日志要求

- 工具错误要带 `toolName`、`toolCallId`、`runId`
- Worker 问题要带 `taskId`、`workerId`
- Runner 问题要带 `stepNumber`
- 路径和权限问题要记录命中的 guard 名称

### 调试结束标准

- 能稳定复现或明确无法复现
- 根因有文字结论
- 修复后至少完成一轮复测
- 日志已更新

---

## 19. 实时日志标准

日志不是收尾工作，日志是开发过程本身。

### 实时性要求

- 开工前先写当前目标
- 进入关键实现前先写计划
- 完成一个明确子步骤后立即追加
- 遇到失败、阻塞、回滚时立即追加
- 不允许等全部做完再一次性补日志

### 必须实时更新的文件

- `docs/DEV_PROGRESS.md`
- `docs/LOG.md`
- 当前开发层的 `docs/progress/layers/*.md`

### 实时日志最少应包含

- 当前在做什么
- 已完成什么
- 卡在哪里
- 下一步是什么

### 日志质量要求

- 用事实，不用模糊表述
- 写清命令是否执行
- 写清测试是否执行
- 写清失败发生在哪一层

---

## 20. 当前文档中的不稳妥点与修正规则

为了避免后续 Codex 误用，以下事项固定修正：

1. 不允许把真实密钥写进仓库文档，哪怕用户在对话里直接给出。
2. `main` 分支不是默认开发分支，除非用户明确要求直推。
3. “禁止自动 push”应理解为“未经用户明确要求，不自动 push”。
4. 测试结果必须区分“未执行”和“执行失败”，不允许混写。
5. 回滚动作必须先看 `git status`，不允许直接做破坏性重置。
6. 所有和网络、凭证、密钥相关的信息，优先走本地环境变量或本机配置，不进仓库。
7. 在测试脚本未落地前，不允许把占位命令写成项目既定标准。

---

## 21. 为了支持 GitHub 仓库测试与回滚，用户必须提供的信息

如果你希望我后续按 GitHub 仓库节奏做开发、测试和回滚，你最好提供以下信息。

当前已知仓库：

- GitHub 仓库地址：`https://github.com/howtio/catnipmvp.git`
- Git SSH 地址：`git@github.com:howtio/catnipmvp.git`

当前状态：

- 当前工作目录 `/home/howtion/catnip` 已初始化为 git 仓库
- 当前分支：`main`
- 当前 remote：`origin -> git@github.com:howtio/catnipmvp.git`
- SSH 已通过 `ssh.github.com:443` 打通
- 当前文档骨架已成功推送到远程仓库

### 必需信息

1. 仓库地址
2. 默认分支名
3. 当前希望我工作的分支名
4. 允许还是不允许我创建新分支
5. 回滚范围偏好

回滚范围偏好请至少说明一种：

- 只允许文件级回滚
- 允许回滚本轮提交
- 允许在测试失败时重置当前开发分支到上一个安全点

### 强烈建议提供的信息

1. 项目包管理器
2. 标准测试命令
3. 标准 typecheck 命令
4. 标准 build 命令
5. 是否存在受保护分支
6. 是否允许直接提交到工作分支
7. 仓库内是否已有未提交本地改动

### 如果需要远程协作再提供

1. 远程名是否是 `origin`
2. 是否已经配置好 git 凭证
3. 是否允许 push
4. 是否要求通过 PR 合并

### 推荐你给我的最小信息模板

你后面可以直接按这个格式发我：

```text
GitHub 仓库地址：
默认分支：
当前开发分支：
是否允许新建分支：
包管理器：
typecheck 命令：
test 命令：
build 命令：
是否有保护分支：
测试失败时允许的回滚方式：
当前仓库是否有未提交修改：
```

### 如果仓库是私有仓库，还需要补充

1. 当前设备是否已经配置 git 访问凭证
2. 我是否应该在当前目录执行 `git clone`
3. clone 到哪个本地目录
4. 是否需要指定 SSH 地址而不是 HTTPS 地址

---

## 22. 新 Codex 在连接 GitHub 仓库后必须做的第一件事

如果已经拿到仓库信息，新的 Codex 接手时必须先做以下检查：

1. 查看当前分支
2. 查看 `git status`
3. 确认是否存在未提交改动
4. 确认测试命令和 typecheck 命令
5. 确认本轮是否允许回滚

只有这些信息明确后，才允许开始代码修改。

如果当前目录还不是 git 仓库，则必须先确认：

1. 是否需要 clone 远程仓库
2. clone 的本地路径
3. 是否具备访问私有仓库的凭证

如果当前目录已经是 git 仓库，则新的 Codex 必须优先检查：

1. `git status`
2. `git branch --show-current`
3. `git remote -v`
4. `git fetch origin`
5. 是否存在未推送提交
