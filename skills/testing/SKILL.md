# Testing Skill

## When to use

当用户要求写测试、修复测试、运行测试、验证功能时使用。

## Process

1. 先读取 `package.json`。
2. 判断包管理器和测试框架。
3. 查看已有 `tests` 或 `src` 目录。
4. 按项目原有风格创建测试文件。
5. 修改后运行测试命令。
6. 如果测试失败，读取错误输出并修复。
7. 最后查看 `git_diff`。
8. 记录测试结果和日志更新状态。
9. 输出测试结果、修改文件、风险、回滚方式。

## Recommended tools

- `list_files`
- `read_file`
- `write_file`
- `patch_file`
- `shell_exec`
- `git_diff`

## Forbidden behavior

- 不允许编造测试结果。
- 不允许没看 `package.json` 就猜测试命令。
- 不允许修改 workspace 外文件。
- 不允许为了通过测试删除核心逻辑。
- 不允许把“未测试”写成“已验证”。
