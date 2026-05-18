# 05 Context

上下文层，负责给 Runner 准备“可用但克制”的施工资料。

## 目标

在不产生副作用的前提下，为模型提供足够上下文。

## 职责

- 读取施工文档
- 扫描 workspace 摘要
- 加载 session history
- 组织 system prompt 基础内容

## 不负责

- 不写文件
- 不执行 shell
- 不调用模型

## 当前阶段

本层必须保持只读，任何副作用都不能从 Context 开始。
