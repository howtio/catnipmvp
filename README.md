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

推荐模型（按资源需求排序）：

| 模型 | 大小 | 特点 |
|------|------|------|
| `qwen2.5:1.5b` | ~900MB | 默认模型，响应快，聊天体验好 |
| `qwen3:1.7b` | ~1.1GB | 比 1.5B 略强 |
| `deepseek-r1:1.5b` | ~1.1GB | 规划准确，但有 thinking 首包延迟 |
| `qwen2.5:0.5b` | ~400MB | 最轻量，适合低配机器 |

下载模型（以默认模型为例）：

```powershell
ollama pull qwen2.5:1.5b
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件（或复制 `.env.example` 后修改）：

```ini
CATNIP_RUNNER_PROVIDER=local
CATNIP_LOCAL_MODEL=qwen2.5:1.5b
CATNIP_LOCAL_HOST=http://localhost:11434
```

各环境变量说明：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CATNIP_RUNNER_PROVIDER` | `auto` | 设为 `local` 强制本地模式 |
| `CATNIP_LOCAL_MODEL` | `qwen2.5:1.5b` | Ollama 模型名 |
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
