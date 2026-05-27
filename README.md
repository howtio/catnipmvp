# catnipmvp

Personal AI agent MVP — runs locally on Windows with Ollama small models, or via DeepSeek API.

## 本地部署（Ollama + 本地模型）

### 1. 安装 Ollama

从 [ollama.com](https://ollama.com) 下载 Windows 安装包并安装。

安装后 Ollama 会自动注册为 Windows 系统服务，开机自启。

验证安装：

```powershell
ollama --version
```

### 2. 下载模型

当前默认模型：`gemma3:1b`（速度最快，~815MB）

所有模型均为 Ollama 格式（GGUF Q4_K_M 量化，大模型标注特殊量化），**纯 CPU 可运行**，无需 GPU。
根据你的内存选择档次：

> **轮数估算前提**：系统 prompt ~600 tok + 每轮约 500 tok（含工具调用）。实际受工具复杂度影响。
> **思维链**：带有 thinking 过程的模型会先输出推理步骤再回答，准但慢。

| 模型 | 参数 | 磁盘 | 最低内存 | 上下文 | 约可对话轮数 | 思维链 | 特点 |
|------|------|------|----------|--------|-------------|--------|------|
| `qwen2.5:0.5b` | 0.5B | 400 MB | 1 GB | 32K | ~50 轮 | ❌ | 最轻量，适合 1GB 旧机器 |
| `gemma3:1b` | 1B | 815 MB | 2 GB | 8K | ~10 轮 | ❌ | **默认**，推理最快 (~2s) |
| `qwen2.5:1.5b` | 1.5B | 900 MB | 2 GB | 32K | ~50 轮 | ❌ | 中文强，原默认 |
| `deepseek-r1:1.5b` | 1.5B | 1.1 GB | 2 GB | 32K | ~50 轮 | ✅ 内置 | 推理强，有首包延迟 |
| `qwen3:1.7b` | 1.7B | 1.1 GB | 2 GB | 32K | ~50 轮 | ⚡ 可选 | Qwen 3 最新架构 |
| `gemma2:2b` | 2B | 1.6 GB | 3 GB | 8K | ~10 轮 | ❌ | Gemma 2，指令跟随好 |
| `qwen2.5:3b` | 3B | 1.9 GB | 3 GB | 32K | ~50 轮 | ❌ | 3B 性价比高 |
| `gemma3:4b` | 4B | 3.2 GB | 4 GB | 32K | ~50 轮 | ❌ | 工具调用明显强于 1B |
| `qwen3:4b` | 4B | 2.5 GB | 4 GB | 128K | ~200 轮 | ⚡ 可选 | 中文优秀，长上下文 |
| `deepseek-r1:7b` | 7B | 4.7 GB | 6 GB | 32K | ~50 轮 | ✅ 内置 | 强推理 thinking |
| `qwen2.5:7b` | 7B | 4.7 GB | 6 GB | 128K | ~200 轮 | ❌ | 稳定可靠，长上下文 |
| `qwen3:8b` | 8B | 5.2 GB | 8 GB | 128K | ~200 轮 | ⚡ 可选 | 中文最强本地选项之一 |
| `gemma2:9b` | 9B | 5.5 GB | 8 GB | 8K | ~10 轮 | ❌ | 英文强 |
| `gemma3:12b` | 12B | 8.5 GB | 10 GB | 32K | ~50 轮 | ❌ | **推荐**，工具调用准确 |
| `qwen2.5:14b` | 14B | 9.5 GB | 12 GB | 128K | ~200 轮 | ❌ | 中文能力强 |
| `deepseek-r1:14b` | 14B | 9.5 GB | 12 GB | 32K | ~50 轮 | ✅ 内置 | 强推理 thinking |
| `qwen3:14b` | 14B | 10 GB | 12 GB | 128K | ~200 轮 | ⚡ 可选 | 最新架构中文优秀 |
| `gemma2:27b` | 27B | 16 GB | 20 GB | 8K | ~10 轮 | ❌ | 英文很强 |
| `qwen3:30b` | 30B | 20 GB | 24 GB | 128K | ~200 轮 | ⚡ 可选 | 本地最强中文选项之一 |
| `qwen2.5:32b` | 32B | 20 GB | 24 GB | 128K | ~200 轮 | ❌ | 中文+工具调用优秀 |
| `deepseek-r1:32b` | 32B | 20 GB | 24 GB | 128K | ~200 轮 | ✅ 内置 | 强推理 thinking |
| `llama3.3:70b` (Q3_K_M) | 70B | 30 GB | 36 GB | 128K | ~200 轮 | ❌ | **极限选项**，70B 需 Q3 |

> **思维链说明**：✅ 内置 = 每次回答自动输出思考过程；⚡ 可选 = 通过 system prompt 可开启思考模式；❌ 无 = 直接回答

下载模型：

```powershell
ollama pull gemma3:1b
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件（或复制 `.env.example` 后修改）：

```ini
CATNIP_RUNNER_PROVIDER=local
CATNIP_LOCAL_MODEL=gemma3:1b
CATNIP_LOCAL_HOST=http://localhost:11434
```

各环境变量说明：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CATNIP_RUNNER_PROVIDER` | `auto` | 设为 `local` 强制本地模式 |
| `CATNIP_LOCAL_MODEL` | `gemma3:1b` | Ollama 模型名 |
| `CATNIP_LOCAL_HOST` | `http://localhost:11434` | Ollama 服务地址 |
| `CATNIP_MEMORY_MAX_ENTRIES` | `3` | 记忆条目数（32K 上下文建议 3） |
| `CATNIP_RUNNER_MAX_STEPS` | `10` | 最大工具调用步数 |
| `CATNIP_RUN_TIMEOUT_MS` | `180000` | 单次运行超时（毫秒） |

### 4. 运行

**方式 A：直接运行（需要 Node 24+）**

```bash
npm install
npm run build
node dist/src/main.js --interactive
```

**方式 B：编译为独立 exe（无需 Node）**

```bash
npm run build-sea
./catnip.exe --interactive
```

**方式 C：启动脚本**

```powershell
.\start-catnip.cmd local
```

### 5. 验证

```bash
./catnip.exe "你好"
```

- 看到 `[plan] no tool calls` 和回答说明运行正常
- 再试写文件：`./catnip.exe "帮我写一个python hello world"`

---

## CLI quick start

- Single task: `node dist/src/main.js "readme and git diff"`
- Multi-task batch: `node dist/src/main.js --task "readme and git diff" --task "shell status"`
- Tasks from file: `node dist/src/main.js --tasks-file tasks.txt`
- Interactive: `node dist/src/main.js --interactive`
- exe interactive: `./catnip.exe` (double-click or command line)
- Debug single task: `node dist/src/main.js --debug "readme and git diff"`
- Pipe input: `echo "readme and git diff" | node dist/src/main.js`

## CLI timeline

- Default output shows a compact run timeline: `[queue]`, `[wait]`, `[run]`, `[stage]`, `[context]`, `[plan]`, `[think]`, `[act]`, `[done]`, `[answer]`
- Startup now prints one pink cat with a line-by-line entry animation and `Welcome to Catnip`
- Wait-related lines use pink; plan lines use yellow; tool action/result lines use green
- Queue lines now show pending position, dispatch moment, and queue wait time before the run starts
- File-changing tools now show a short change summary, including created/updated file previews and patch `search -> replace`
- Browser preview uses `open_browser`, limited to `workspaces/demo/*.html`
- Web search uses `web_search`; browser search uses `open_browser_search`
- Search result links or explicit web pages can be opened with `open_url`
- Long-running tasks also print `[timer]` heartbeat lines with elapsed time, idle time since last activity, and the last observed activity
- Batch mode adds `[orchestrator]` lines so queued task count and completion summary stay visible
- `--debug` keeps the compact timeline and adds raw event payloads as `[debug] ...`

## Interactive commands

- `/help`
- `/history`
- `/last`
- `/clear`
- `/exit`

## Interactive follow-up

- In `--interactive` mode, if you type extra text while a task is still running, Catnip captures it as a follow-up refinement for the next turn
- The current in-flight model call is not mutated mid-run; the refinement is applied as the next queued interactive turn after the current task finishes

## Debug tracing

- CLI realtime debug: `CATNIP_CLI_DEBUG=1 node dist/src/main.js --interactive`
- Local trace log: `logs/catnip-trace.jsonl`
- Core event log: `logs/catnip.jsonl`
- Layer status lines: `04-harness`, `05-context`, `06-skills`, `07-runner`, `08-eventbus -> 10-executor`

## Timeout

- Default `CATNIP_RUN_TIMEOUT_MS` is `180000`
- You can still override it per shell session or command invocation
