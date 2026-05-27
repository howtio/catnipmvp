# Catnip Agent Gemma 3 1B 微调方案

## 概述

对 gemma3:1b 进行 LoRA 微调，提升其工具调用决策能力。

**当前问题**: 1B 模型不知道何时调用工具（准确率 ~40%），依赖 heuristic 关键词匹配补救。

**目标**: 工具调用准确率从 ~40% → ~70%，减少对 heuristic 的依赖。

---

## 1. 数据准备

### 1.1 格式

每条样本包含用户指令和对应的工具调用计划。使用当前 OpenAI 兼容格式：

```json
{
  "instruction": "用户输入文本",
  "output": {
    "plannedToolCalls": [
      { "name": "工具名", "args": { ...参数 } }
    ],
    "finalAnswerPrompt": "返回给用户的回答"
  }
}
```

### 1.2 工具清单

训练数据中的工具名和参数必须与以下一致：

| 工具名 | 参数 | 权限 | 说明 |
|--------|------|------|------|
| `list_files` | `{ path: string }` | low | 列出目录 |
| `read_file` | `{ path: string }` | low | 读文件 |
| `write_file` | `{ path, content }` | medium | 写文件 |
| `patch_file` | `{ path, search, replace }` | medium | 替换文本 |
| `shell_exec` | `{ command, argv }` | medium | 运行命令 |
| `git_diff` | `{}` | medium | Git 差异 |
| `open_browser` | `{ path }` | medium | 打开 HTML |
| `web_search` | `{ query, limit }` | medium | 网页搜索 |
| `open_browser_search` | `{ query }` | medium | 浏览器搜索 |
| `open_url` | `{ url }` | medium | 打开 URL |

### 1.3 样本分类与数量

| 类别 | 数量 | 说明 |
|------|------|------|
| 写代码 | 80 | Python/JS/TS/Java/C++ |
| 写 HTML | 60 | 含复合任务（写+打开） |
| 写文本 | 40 | 情书、诗、故事、文章 |
| 搜索 | 40 | web_search + open_browser_search |
| 打开浏览器/文件 | 40 | open_browser, open_url |
| Shell 命令 | 30 | git, npm, node, dir |
| 读文件 | 20 | read_file, list_files |
| Git 操作 | 10 | git_diff |
| 修改/修补 | 30 | patch_file, 改颜色/内容 |
| 删除 | 10 | （预留 delete_file） |
| **无需工具** | **100** | 问候、身份、闲聊、情感 |
| **边界案例** | **60** | heuristic 未覆盖的输入 |
| **总计** | **~520** | |

### 1.4 生成策略

#### A. 模板化生成 (~400条)

用脚本批量生成，每类使用模板 + 随机参数：

```
写代码模板:
  instruction: "帮我写一个{语言}代码是{功能}"
  output: write_file(path="workspaces/demo/{文件名}.{ext}", content="{代码内容}")

写HTML+打开模板:
  instruction: "帮我写一个{主题}html然后打开"
  output: write_file → open_browser

无需工具模板:
  instruction: "{问候语/身份问题}"
  output: [], finalAnswerPrompt="{预设回答}"
```

#### B. 边界案例手工标注 (~60条)

从测试失败的输入中收集，手工标注正确 tool plan：

```
"帮我改成粉色" → patch_file(path="xxx.html", search="<style>", replace="<style>body { background: pink; }")
"帮我删掉工作区里的文件" → （需 delete_file 工具）
"你的tooljson是什么样子的" → [], "我的工具调用格式是 OpenAI 兼容格式..."
```

#### C. 真实数据增强 (~60条)

用大模型（DeepSeek-v3 等）对模板数据进行改写，增加自然语言多样性。

---

## 2. 训练环境

### 2.1 推荐: Google Colab (免费 T4)

**内存**: 16GB VRAM (T4) — 足够运行 4-bit QLoRA

**框架**: Unsloth (2x 训练速度，更低显存)

### 2.2 Colab Notebook 结构

```
1. 安装依赖
   └── pip install unsloth bitsandbytes transformers datasets

2. 挂载 Google Drive
   └── 加载 JSON 训练数据

3. 加载基础模型 (4-bit)
   └── model = FastLanguageModel.from_pretrained("unsloth/gemma-3-1b-bnb-4bit")

4. 配置 LoRA
   └── rank=16, alpha=32, target_modules=[q_proj,k_proj,v_proj,o_proj]

5. 格式化数据集
   └── instruction → output 对，应用对话模板

6. 训练
   └── SFTTrainer, max_steps=500, batch=8, lr=2e-4

7. 保存 adapter
   └── model.save_pretrained("catnip-lora-adapter")

8. 合并 + 导出 GGUF
   └── 合并权重 → 导出 Ollama 格式
```

### 2.3 本地训练 (RTX 3060+ 12GB)

也可在本地运行，配置同上，只需安装 CUDA 工具链。

---

## 3. 训练参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 基础模型 | gemma3:1b | 当前 Ollama 模型 |
| LoRA rank | 16 | 参数更新矩阵的秩 |
| LoRA alpha | 32 | 缩放因子 |
| 目标模块 | q_proj, k_proj, v_proj, o_proj | 所有 attention 投影 |
| 精度 | 4-bit NF4 (QLoRA) | 量化以降低显存 |
| 学习率 | 2e-4 | AdamW 优化器 |
| 批次大小 | 8 (gradient accumulation=2) | 有效批次 16 |
| 训练步数 | 500 | 约 30-45 分钟 on T4 |
|  warmup | 50 steps | 线性预热 |
| 序列长度 | 4096 tokens | 覆盖完整工具调用 |
| 数据集 | ~520 条 | 80% 训练 / 10% 验证 / 10% 测试 |
| 验证频率 | 每 50 步 | 监控 overfitting |

---

## 4. 部署流程

### 4.1 导出适配器

```python
model.save_pretrained("catnip-lora-adapter")
tokenizer.save_pretrained("catnip-lora-adapter")
```

### 4.2 合并权重

```python
from unsloth import FastLanguageModel
model, tokenizer = FastLanguageModel.from_pretrained("gemma3:1b")
model.load_adapter("catnip-lora-adapter")
merged = model.merge_and_unload()
merged.save_pretrained("gemma3-catnip-merged")
```

### 4.3 导出 Ollama GGUF

```bash
# 使用 llama.cpp 转换
python convert_hf_to_gguf.py gemma3-catnip-merged --outfile gemma3-catnip.gguf

# 创建 Modelfile
echo "FROM gemma3-catnip.gguf" > Modelfile

# 导入到 Ollama
ollama create gemma3:catnip-tuned -f Modelfile
```

### 4.4 在 Catnip 中使用

```bash
# 设置环境变量
set CATNIP_LOCAL_MODEL=gemma3:catnip-tuned
set CATNIP_RUNNER_PROVIDER=local

# 运行
catnip.exe
```

---

## 5. 评估方法

### 5.1 测试集（52 条，从训练集预留）

| 类别 | 数量 | 评估指标 |
|------|------|----------|
| 写代码 | 8 | 工具名正确 + 路径合法 |
| 写 HTML | 6 | 工具名正确 + 路径合法 |
| 写文本 | 4 | 不拒绝（内容非空） |
| 搜索 | 4 | 调用 web_search |
| 打开浏览器 | 4 | 调用 open_browser |
| Shell 命令 | 3 | 调用 shell_exec |
| 读文件 | 2 | 调用 read_file |
| 修改 | 3 | 调用 patch_file |
| 无需工具 | 10 | 返回空 plannedToolCalls |
| 边界案例 | 8 | 各任务类型正确 |

### 5.2 评估流程

```
1. 对测试集每条输入，让模型生成 tool plan
2. 对比生成的 tool plan 与期望 plan
3. 计算每类的准确率
4. 端到端 22 条测试用例（来自 1BTESTLOG.md）
```

### 5.3 预期指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 总体工具调用准确率 | ~40% | ~70% |
| 无工具场景准确率 | ~60% | ~85% |
| 参数正确性 | ~50% | ~80% |
| 端到端 22 条测试通过率 | 56% | 75% |
| 安全拒绝误伤（情书类） | ~50% | <20% |

---

## 6. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 过拟合 heuristic 规则 | 训练数据含 20% 边界案例 + 10% 验证集监控 loss |
| 灾难性遗忘（对话能力下降） | 保留 ~30% Q&A 数据，低 rank(16)，早停 |
| 内容生成质量下降 | 训练数据中写内容类使用真实代码/文本，而非占位符 |
| 训练后与 heuristic 冲突 | heuristic 优先级高于模型输出，模型退化时 heuristic 兜底 |

---

## 7. 执行时间线

| 阶段 | 内容 | 预计时间 |
|------|------|----------|
| Phase 1 | 运行数据生成脚本 → 得到 ~520 条 JSON | 30 分钟 |
| Phase 2 | 人工审核边界案例（60 条），修正错误标注 | 1-2 小时 |
| Phase 3 | Google Colab 训练 | 45 分钟 |
| Phase 4 | 导出 GGUF + 导入 Ollama | 30 分钟 |
| Phase 5 | 运行 22 条测试用例验证 | 10 分钟 |
| Phase 6 | 补充 bad case 数据 → 第二轮微调 | 按需 |
