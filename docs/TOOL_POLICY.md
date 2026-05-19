# Tool Policy

## 权限等级

### low

允许：

- `list_files`
- `read_file`

拒绝：

- `write_file`
- `patch_file`
- `shell_exec`
- `open_browser`
- `web_search`
- `open_browser_search`

### medium

允许：

- `list_files`
- `read_file`
- `write_file`
- `patch_file`
- `git_diff`
- `open_browser`
- `web_search`
- `open_browser_search`

受限允许：

- `shell_exec`
- `open_browser`
- `web_search`
- `open_browser_search`

允许命令白名单：

- `npm test`
- `npm run test`
- `npm run build`
- `pnpm test`
- `pnpm build`
- `git status`
- `git diff`
- `ls`
- `cat`

浏览器预览限制：

- `open_browser` 仅允许打开 `workspaces/demo/` 下的 `.html/.htm` 文件
- 不允许直接打开 workspace 任意文件
- 不允许借此执行任意 shell 命令

搜索工具限制：

- `web_search` 仅允许传入文本查询词和受限 `limit`
- `web_search` 当前通过 DuckDuckGo HTML 返回结构化结果
- `open_browser_search` 仅允许把查询词交给默认搜索引擎打开
- 不允许把 `open_browser_search` 当成任意 URL 打开器

### high

允许：

- `medium` 全部能力

后续可扩展：

- `npm install`
- `pnpm install`

## 始终禁止

- `rm`
- `rm -rf`
- `sudo`
- `chmod`
- `chown`
- `curl`
- `wget`
- `ssh`
- `scp`
- `git push`
- `npm publish`
- `docker`
- `powershell`

## 路径策略

- 仅允许访问 workspace 内路径
- 所有路径操作必须经过 pathGuard
- 不允许越过项目根目录

## 命令策略

- 所有 shell 命令必须经过 commandGuard
- 不允许执行危险命令
- 不允许拼接不透明动态命令

## 当前阶段说明

本阶段只写策略文档，不实现 guard 代码。
