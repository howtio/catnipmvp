# 07 Runner

决策层，负责模型推理循环和工具调用决策。

## 目标

把模型输出限制在可控 ReAct Loop 中，并通过 EventBus 间接使用工具。

## 职责

- 驱动模型循环
- 决定是否调用工具
- 通过 EventBus 请求工具
- 归一化最终回答

## 不负责

- 不直接执行工具
- 不直接读写文件
- 不直接执行 shell

## DeepSeek 方向

后续模型 provider 默认优先考虑 DeepSeek，但必须先做 provider adapter，再做真实接入。
