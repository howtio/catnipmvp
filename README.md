# catnipmvp
its my mvp agent for catnipent

## CLI quick start

- Single task: `node dist/src/main.js "readme and git diff"`
- Multi-task batch: `node dist/src/main.js --task "readme and git diff" --task "shell status"`
- Tasks from file: `node dist/src/main.js --tasks-file tasks.txt`
- Interactive: `node dist/src/main.js --interactive`
- Debug single task: `node dist/src/main.js --debug "readme and git diff"`
- Pipe input: `echo "readme and git diff" | node dist/src/main.js`
- HTML preview smoke: `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "create file html and open browser run html"`
- Web search smoke: `CATNIP_RUNNER_PROVIDER=heuristic CATNIP_BROWSER_OPEN_BIN=true node dist/src/main.js "web search latest catnip agent runtime and open browser search"`

## CLI timeline

- Default output shows a compact run timeline: `[queue]`, `[wait]`, `[run]`, `[stage]`, `[context]`, `[plan]`, `[think]`, `[act]`, `[done]`, `[answer]`
- Startup now prints a pink cat banner and `Welcome to Catnip`
- Wait-related lines use pink; plan lines use yellow; tool action/result lines use green
- Queue lines now show pending position, dispatch moment, and queue wait time before the run starts
- File-changing tools now show a short change summary, including created/updated file previews and patch `search -> replace`
- Browser preview uses `open_browser`, limited to `workspaces/demo/*.html`
- Web search uses `web_search`; browser search uses `open_browser_search`
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
