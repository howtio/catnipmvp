# catnipmvp
its my mvp agent for catnipent

## CLI quick start

- Single task: `node dist/src/main.js "readme and git diff"`
- Interactive: `node dist/src/main.js --interactive`
- Debug single task: `node dist/src/main.js --debug "readme and git diff"`
- Pipe input: `echo "readme and git diff" | node dist/src/main.js`

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
