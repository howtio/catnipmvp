# catnipmvp
its my mvp agent for catnipent

## CLI quick start

- Single task: `node dist/src/main.js "readme and git diff"`
- Multi-task batch: `node dist/src/main.js --task "readme and git diff" --task "shell status"`
- Tasks from file: `node dist/src/main.js --tasks-file tasks.txt`
- Interactive: `node dist/src/main.js --interactive`
- Debug single task: `node dist/src/main.js --debug "readme and git diff"`
- Pipe input: `echo "readme and git diff" | node dist/src/main.js`

## CLI timeline

- Default output shows a compact run timeline: `[queue]`, `[run]`, `[stage]`, `[context]`, `[plan]`, `[think]`, `[act]`, `[done]`, `[answer]`
- Batch mode adds `[orchestrator]` lines so queued task count and completion summary stay visible
- `--debug` keeps the compact timeline and adds raw event payloads as `[debug] ...`

## Interactive commands

- `/help`
- `/history`
- `/last`
- `/clear`
- `/exit`

## Debug tracing

- CLI realtime debug: `CATNIP_CLI_DEBUG=1 node dist/src/main.js --interactive`
- Local trace log: `logs/catnip-trace.jsonl`
- Core event log: `logs/catnip.jsonl`
- Layer status lines: `04-harness`, `05-context`, `06-skills`, `07-runner`, `08-eventbus -> 10-executor`
