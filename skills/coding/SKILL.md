# Coding Skill

## When to use

当用户要求新增功能、修改代码、创建文件、实现函数时使用。

## Process

1. 先理解任务范围。
2. 先 `list_files` 查看项目结构。
3. 再 `read_file` 查看相关文件。
4. 不允许未读文件直接修改。
5. 只做最小必要修改。
6. 修改后查看 `git_diff`。
7. 输出修改摘要、风险、回滚方式。

## Recommended tools

- `list_files`
- `read_file`
- `write_file`
- `patch_file`
- `git_diff`

## Forbidden behavior

- 不允许修改 workspace 外文件。
- 不允许大范围重构。
- 不允许修改无关文件。
- 不允许编造不存在的文件内容。
