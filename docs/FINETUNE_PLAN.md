# Catnip 1.5B 微调执行计划

## 概览

对 qwen2.5:1.5b 进行 LoRA 微调，提升工具调用决策能力。采用 **Claude Code + DeepSeek V4 Pro 混合生成** 训练数据。

**当前**: 工具调用准确率 ~40%，heuristic 兜底后整体 56%
**目标**: 工具调用准确率 ~70%，端到端 22 条测试通过率 75%

---

## Phase 1: 训练数据生成

### 1.1 数据格式

```json
{
  "instruction": "用户输入",
  "output": {
    "plannedToolCalls": [
      { "name": "工具名", "args": { ... } }
    ],
    "finalAnswerPrompt": "返回给用户的回答"
  }
}
```

### 1.2 工具清单

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `list_files` | `{ path }` | 列出目录 |
| `read_file` | `{ path }` | 读文件 |
| `write_file` | `{ path, content }` | 写文件 |
| `patch_file` | `{ path, search, replace }` | 替换文本 |
| `shell_exec` | `{ command, argv }` | 运行命令 |
| `git_diff` | `{}` | Git 差异 |
| `open_browser` | `{ path }` | 打开 HTML(限 workspaces/demo/) |
| `web_search` | `{ query, limit }` | 网页搜索 |
| `open_browser_search` | `{ query }` | 浏览器搜索 |
| `open_url` | `{ url }` | 打开 URL(限 http/https) |

### 1.3 数据量分配

**总计 8000 条，两种生成方式：**

#### A. Claude Code 生成 (3500 条) — 需要代码库理解

| 类别 | 数量 | 说明 |
|------|------|------|
| 无需工具 Q&A | 1500 | 问候、身份、闲聊、情感 — 核心负样本 |
| 边界案例 | 800 | heuristic 漏掉的表述："改粉色"、"你的json"、"转html" |
| 复合任务 | 800 | 多步："写html然后打开"、"搜索某某然后打开链接" |
| 修改/修补 | 400 | patch_file 各种变体 |

**小计: 3500 条**

#### B. DeepSeek V4 Pro API 生成 (4500 条) — 纯体力活

| 类别 | 数量 | 说明 |
|------|------|------|
| 写代码 | 800 | Python/JS/TS/Go/Java/Rust — 各语言多样化 |
| 写 HTML | 600 | 不同主题(游戏/工具/页面/可视化) |
| 写文本 | 400 | 情书、诗、故事、文章 |
| 搜索 | 500 | web_search + open_browser_search |
| 打开浏览器/URL | 600 | open_browser + open_url |
| Shell 命令 | 500 | git/npm/dir/type/node 等 |
| 读文件/列出文件 | 400 | read_file + list_files |
| Git diff | 200 | git_diff |
| 情感/闲聊 | 500 | 对话多样性 |

**小计: 4500 条**

**总计: 8000 条**

### 1.4 质量检查流程

```
Claude Code / DeepSeek V4 Pro
       │
       ▼
   生成 JSONL
       │
       ▼
   自动格式校验
   ├── 字段完整性 (instruction, output.plannedToolCalls, output.finalAnswerPrompt)
   ├── 工具名是否在允许清单中
   ├── 参数是否合法 (路径在 workspaces/demo/ 内, URL 为 http/https 等)
   └── 无工具场景的 plannedToolCalls 必须为空数组
       │
       ▼
   人工抽检 (~5%)
   └── 随机抽取 400 条检查：
       ├── instruction 是否自然语言
       ├── output 是否匹配 instruction
       └── finalAnswerPrompt 是否合理
```

### 1.5 成本估算

| 生成方式 | 数量 | 成本 |
|----------|------|------|
| Claude Code | 3500 条 | $0 (已订阅) |
| DeepSeek V4 Pro | 4500 条 | ~$2-3 |
| **总计** | **8000 条** | **~$2-3** |

DeepSeek V4 Pro 计算明细：
- 输入: 4500 × 600tok × $0.435/M = ~$1.17
- 输出: 4500 × 400tok × $0.87/M = ~$1.57
- 合计: ~$2.74

---

## Phase 2: 训练

### 2.1 环境

| 选项 | 说明 |
|------|------|
| 推荐 | Google Colab (免费 T4, 16GB VRAM) |
| 框架 | Unsloth (2x 训练速度) |
| 精度 | 4-bit QLoRA (NF4) |

### 2.2 参数

| 参数 | 值 | 说明 |
|------|-----|------|
| 基础模型 | qwen2.5:1.5b | Ollama 可用 |
| LoRA rank | 16 | 更新矩阵秩 |
| LoRA alpha | 32 | 缩放因子 |
| 目标模块 | q_proj, k_proj, v_proj, o_proj | 全部 attention |
| 学习率 | 2e-4 | AdamW |
| 批次大小 | 8 (gradient accumulation=2) | 有效批次 16 |
| 训练步数 | 800-1000 | 数据集大，步数增加 |
| Warmup | 100 steps | 线性预热 |
| 序列长度 | 4096 tokens | 覆盖完整 tool plan |

### 2.3 数据分割

| 分集 | 比例 | 数量 |
|------|------|------|
| 训练集 | 85% | 6800 |
| 验证集 | 10% | 800 |
| 测试集 | 5% | 400 |

---

## Phase 3: 评估

### 3.1 自动化测试

| 测试 | 内容 | 目标 |
|------|------|------|
| 400 条测试集准确率 | 工具名 + 参数是否正确 | ≥70% |
| 无工具场景误调率 | 不需要工具时是否调了 | ≤15% |
| 参数合法率 | 路径、查询等参数格式 | ≥80% |

### 3.2 端到端测试

运行 `docs/1.5BTESTLOG.md` 中 22 条测试用例：

| 用例 | 输入 | 期望 |
|------|------|------|
| TC-001~003 | 问候/身份 | 无工具，直接回答 |
| TC-006~008 | 写代码/文本/HTML | write_file |
| TC-012~013 | 打开浏览器 | open_browser |
| TC-009~010 | 写+打开复合 | write_file → open_browser |
| TC-014 | 修改文件 | patch_file |
| TC-016 | 列出文件 | list_files |
| TC-021 | 知识问答 | web_search |
| TC-004~005 | 情感对话 | 无工具，共情回答 |
| 新增 | "你的json" | 无工具，预设回答 |
| 新增 | "改粉色" | patch_file |

**目标: 22 条中通过 ≥17 条 (75%)**

---

## Phase 4: 部署

```
训练完成
    │
    ▼
合并 LoRA 权重
    │
    ▼
导出 GGUF 格式 (通过 llama.cpp)
    │
    ▼
创建 Ollama 模型
echo "FROM qwen2.5-catnip.gguf" > Modelfile
ollama create qwen2.5:catnip-tuned -f Modelfile
    │
    ▼
配置 catnip 使用新模型
set CATNIP_LOCAL_MODEL=qwen2.5:catnip-tuned
set CATNIP_RUNNER_PROVIDER=local
catnip.exe
    │
    ▼
运行完整端到端测试
```

---

## Phase 5: 迭代

根据评估结果决定下一步：

| 结果 | 行动 |
|------|------|
| 测试通过率 ≥75% | 发布 v1，收集真实用户数据 |
| 测试通过率 60-75% | 补充 bad case 数据，第二轮微调 |
| 测试通过率 <60% | 检查数据质量，增加每类样本量 |
| 某类特别差 | 单独补充该类训练数据，局部微调 |

---

## 时间线

| 阶段 | 内容 | 预计 |
|------|------|------|
| Phase 1A | Claude Code 生成 3500 条 | ~2 小时 |
| Phase 1B | DeepSeek V4 Pro 生成 4500 条 | ~30 分钟 + $3 |
| Phase 1C | 格式校验 + 人工抽检 | ~1 小时 |
| Phase 2 | Colab 训练 (800 steps) | ~45 分钟 |
| Phase 3 | 评估 + 22 条端到端测试 | ~30 分钟 |
| Phase 4 | 部署 + 验证 | ~30 分钟 |
| Phase 5 | 迭代优化 | 按需 |
| **总计** | | **~5 小时 + $3** |

---

## 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| DeepSeek V4 Pro 生成格式错误 | 中 | 自动校验脚本过滤，重试 |
| 模板数据多样性不足 | 中 | DeepSeek 生成自然语言变体 |
| 过拟合训练集 | 低 | 验证集 loss 监控 + 早停 |
| 灾难性遗忘(对话能力) | 低 | 30% Q&A 数据 + 低 rank |
| 微调后 heuristic 冲突 | 低 | heuristic 优先级高于模型 |
