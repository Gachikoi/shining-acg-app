# {{SKILL_NAME}} —— {{SKILL_TAGLINE}} 技术设计方案

<!-- 生成时必须对照：skill-builder/references/skill-best-practices.md -->
<!-- 说明：SKILL_NAME 填 Skill 的正式名称，如 "git-commit-builder" -->
<!-- 说明：SKILL_TAGLINE 填一句话简介，如 "Git Commit 信息智能生成助手" -->

> **定位**：{{SKILL_POSITIONING}}
> 它会先{{PHASE_1_SUMMARY}}，然后{{PHASE_2_SUMMARY}}，最后{{PHASE_3_SUMMARY}}。
> **适用级别**：{{PRACTICE_LEVEL}}（L1 最小 / L2 标准 / L3 元数据驱动，见 best-practices §0）

<!-- 说明：SKILL_POSITIONING 描述 Skill 的核心价值，1~2 句 -->
<!-- 说明：PHASE_1/2/3_SUMMARY 描述三个主要阶段各自做什么 -->

---

## 一、Skill 整体架构

### 1.1 核心设计原则

<!-- 须覆盖 best-practices：单一职责 / 契约优先 / 渐进披露 / 结构化 / 可观测 / 澄清交互（逐项·自然语言）；可用 skill-builder 为参照 -->

- **{{PRINCIPLE_1_NAME}}**：{{PRINCIPLE_1_DESC}}
- **{{PRINCIPLE_2_NAME}}**：{{PRINCIPLE_2_DESC}}
- **{{PRINCIPLE_3_NAME}}**：{{PRINCIPLE_3_DESC}}

### 1.2 目录结构

```
{{SKILL_NAME}}/
├── SKILL.md                          # AI 行为说明书（非系统配置）
├── schema.json                       # 【必选】契约：inputs/outputs/pre/post/fallbacks/security
├── metadata.yaml                     # 【建议】版本、依赖、能力
├── hooks/
│   ├── pre-execution.md              # 激活后前置检查
│   └── post-execution.md             # 结束后标准摘要
├── references/
│   ├── {{REF_FILE_1}}                # {{REF_FILE_1_DESC}}
│   └── flows/                        # 各流程详细步骤（Progressive Disclosure）
├── templates/
│   ├── skill-md-template.md
│   ├── schema-template.json          # schema 骨架
│   └── output-summary-template.md
├── examples/
│   ├── {{EXAMPLE_GOOD}}
│   └── {{EXAMPLE_BAD}}
├── scripts/
│   ├── skill-self-check.md           # 自检清单
│   └── validate-skill-structure.ts   # 【建议】结构校验
└── docs/
    └── DESIGN.md                     # 设计决策
```

<!-- 说明：根据实际设计填充各文件名和说明；按 L1/L2/L3 裁剪目录，原则不可违反 -->

---

## 二、SKILL.md 核心内容设计

### 2.1 元数据与触发词

```yaml
name: "{{SKILL_NAME}}"
description: |
  {{SKILL_DESCRIPTION_LINE_1}}
  {{SKILL_DESCRIPTION_LINE_2}}
  支持{{FLOW_COUNT}}种模式：
  1. {{FLOW_1_NAME}}：{{FLOW_1_TRIGGER_WORDS}}
  2. {{FLOW_2_NAME}}：{{FLOW_2_TRIGGER_WORDS}}
  当用户说「{{TRIGGER_WORD_1}}」「{{TRIGGER_WORD_2}}」「{{TRIGGER_WORD_3}}」时激活。
version: "1.0.0"
author: "{{AUTHOR}}"
timeout: {{TIMEOUT}}
retry: 2
parameters:
  - name: "mode"
    type: "string"
    enum: [{{MODE_ENUM_VALUES}}]
    default: "{{MODE_DEFAULT}}"
    description: "{{MODE_ENUM_DESC}}"
```

<!-- 说明：FLOW_COUNT 填数字；TRIGGER_WORD 至少 5 个，覆盖中文口语/英文/简短变体 -->
<!-- 说明：TIMEOUT 建议复杂 Skill 设置 ≥ 600 秒 -->

**触发词完整列表：**

| 触发词 | 语言 | 进入模式 |
|--------|------|---------|
| `{{TRIGGER_1}}` | 中文 | {{MODE_1}} |
| `{{TRIGGER_2}}` | 中文 | {{MODE_1}} |
| `{{TRIGGER_3}}` | 英文 | {{MODE_1}} |
| `{{TRIGGER_4}}` | 中文 | {{MODE_2}} |
| `{{TRIGGER_5}}` | 英文 | {{MODE_2}} |

<!-- 说明：触发词至少覆盖 3 种语言/风格，每种模式至少 2 个 -->

### 2.2 流程分支总览

| 流程 | 触发词/触发条件 | 进入条件 | 前置条件 |
|------|--------------|---------|---------|
| {{FLOW_1_NAME}} | {{FLOW_1_TRIGGERS}} | {{FLOW_1_ENTRY_CONDITION}} | {{FLOW_1_PREREQ}} |
| {{FLOW_2_NAME}} | {{FLOW_2_TRIGGERS}} | {{FLOW_2_ENTRY_CONDITION}} | {{FLOW_2_PREREQ}} |
| {{FLOW_3_NAME}} | {{FLOW_3_TRIGGERS}} | {{FLOW_3_ENTRY_CONDITION}} | {{FLOW_3_PREREQ}} |

<!-- 说明：「前置条件」描述进入该流程需要哪些已完成的状态，无则填「无」 -->

---

## 三、流程一：{{FLOW_1_NAME}}（{{FLOW_1_EN_NAME}}）

> ⚙️ **本流程使用伪代码描述决策流，LLM 应按伪代码分支逻辑执行，不得跳过任何 `if` / `while` 分支。**

**目标**：{{FLOW_1_GOAL}}

<!-- 说明：目标描述本流程结束后，用户/系统得到了什么 -->

### 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | {{FLOW_1_STEP_1_ACTION}} | {{FLOW_1_STEP_1_DONE}} | {{FLOW_1_STEP_1_LOOP}} |
| Step 2 🔒 | {{FLOW_1_STEP_2_ACTION}} | {{FLOW_1_STEP_2_DONE}} | {{FLOW_1_STEP_2_LOOP}} |
| Step 3 🔒 | {{FLOW_1_STEP_3_ACTION}} | {{FLOW_1_STEP_3_DONE}} | {{FLOW_1_STEP_3_LOOP}} |
| Step 4 🔒 | {{FLOW_1_STEP_4_ACTION}} | {{FLOW_1_STEP_4_DONE}} | {{FLOW_1_STEP_4_LOOP}} |
| Step 5 | {{FLOW_1_STEP_5_ACTION}} | {{FLOW_1_STEP_5_DONE}} | — |

<!-- 说明：步骤数量 ≥ 4；🔒 标记必须执行的步骤；完成条件不能为空 -->

### Loop 节点伪代码

```pseudo
// {{FLOW_1_LOOP_1_COMMENT}}
{{FLOW_1_LOOP_1_PSEUDOCODE}}

// {{FLOW_1_LOOP_2_COMMENT}}
{{FLOW_1_LOOP_2_PSEUDOCODE}}
```

<!-- 说明：每个 Loop 必须有终止条件（break/continue/max_retry/用户确认）-->
<!-- 说明：禁止使用「→」箭头形式，必须是 if/while/for 结构 -->

---

## 四、流程二：{{FLOW_2_NAME}}（{{FLOW_2_EN_NAME}}）

> ⚙️ **本流程使用伪代码描述决策流，LLM 应按伪代码分支逻辑执行，不得跳过任何 `if` / `while` 分支。**

**目标**：{{FLOW_2_GOAL}}

### 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | {{FLOW_2_STEP_1_ACTION}} | {{FLOW_2_STEP_1_DONE}} | {{FLOW_2_STEP_1_LOOP}} |
| Step 2 🔒 | {{FLOW_2_STEP_2_ACTION}} | {{FLOW_2_STEP_2_DONE}} | {{FLOW_2_STEP_2_LOOP}} |
| Step 3 🔒 | {{FLOW_2_STEP_3_ACTION}} | {{FLOW_2_STEP_3_DONE}} | {{FLOW_2_STEP_3_LOOP}} |
| Step 4 🔒 | {{FLOW_2_STEP_4_ACTION}} | {{FLOW_2_STEP_4_DONE}} | {{FLOW_2_STEP_4_LOOP}} |
| Step 5 | {{FLOW_2_STEP_5_ACTION}} | {{FLOW_2_STEP_5_DONE}} | — |

### Loop 节点伪代码

```pseudo
// {{FLOW_2_LOOP_1_COMMENT}}
{{FLOW_2_LOOP_1_PSEUDOCODE}}

// {{FLOW_2_LOOP_2_COMMENT}}
{{FLOW_2_LOOP_2_PSEUDOCODE}}
```

---

## 五、流程三：{{FLOW_3_NAME}}（{{FLOW_3_EN_NAME}}）

> ⚙️ **本流程使用伪代码描述决策流，LLM 应按伪代码分支逻辑执行，不得跳过任何 `if` / `while` 分支。**

**目标**：{{FLOW_3_GOAL}}

### 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | {{FLOW_3_STEP_1_ACTION}} | {{FLOW_3_STEP_1_DONE}} | {{FLOW_3_STEP_1_LOOP}} |
| Step 2 🔒 | {{FLOW_3_STEP_2_ACTION}} | {{FLOW_3_STEP_2_DONE}} | {{FLOW_3_STEP_2_LOOP}} |
| Step 3 🔒 | {{FLOW_3_STEP_3_ACTION}} | {{FLOW_3_STEP_3_DONE}} | {{FLOW_3_STEP_3_LOOP}} |
| Step 4 🔒 | {{FLOW_3_STEP_4_ACTION}} | {{FLOW_3_STEP_4_DONE}} | {{FLOW_3_STEP_4_LOOP}} |
| Step 5 | {{FLOW_3_STEP_5_ACTION}} | {{FLOW_3_STEP_5_DONE}} | — |
| Step 6 | {{FLOW_3_STEP_6_ACTION}} | {{FLOW_3_STEP_6_DONE}} | — |

### Loop 节点伪代码

```pseudo
// {{FLOW_3_LOOP_1_COMMENT}}
{{FLOW_3_LOOP_1_PSEUDOCODE}}

// {{FLOW_3_LOOP_2_COMMENT}}
{{FLOW_3_LOOP_2_PSEUDOCODE}}
```

---

## 六、核心子文件设计

<!-- 说明：为每个子文件写一行说明，包含「何时读取」和「内容示例」 -->

### `references/{{REF_FILE_1}}` — {{REF_FILE_1_SHORT_DESC}}

| 属性 | 说明 |
|------|------|
| **职责** | {{REF_FILE_1_ROLE}} |
| **何时读取** | {{REF_FILE_1_WHEN}} |
| **内容要求** | {{REF_FILE_1_CONTENT_REQ}} |

**内容示例**：
```
{{REF_FILE_1_EXAMPLE}}
```

---

### `templates/{{TEMPLATE_FILE_1}}` — {{TEMPLATE_FILE_1_SHORT_DESC}}

| 属性 | 说明 |
|------|------|
| **职责** | {{TEMPLATE_FILE_1_ROLE}} |
| **何时读取** | {{TEMPLATE_FILE_1_WHEN}} |
| **关键占位符** | `{{TEMPLATE_KEY_PLACEHOLDER_1}}`、`{{TEMPLATE_KEY_PLACEHOLDER_2}}` |

---

### `examples/{{EXAMPLE_GOOD}}` — 优质案例

| 属性 | 说明 |
|------|------|
| **职责** | 提供高质量输出样本，作为 Few-shot 质量上界 |
| **何时读取** | {{FLOW_2_NAME}} 或 {{FLOW_3_NAME}} 开始生成前读取 |
| **内容结构** | ① 关键结构片段 ② ✅ 批注说明好在哪 |

---

### `examples/{{EXAMPLE_BAD}}` — 反例案例

| 属性 | 说明 |
|------|------|
| **职责** | 展示典型错误模式，作为负向 Few-shot 下界警示 |
| **何时读取** | 自检阶段读取，对照检查是否存在类似错误 |
| **内容结构** | ① 反例片段 ② ❌ 错误原因 ③ ✅ 改写版本 |

---

### `scripts/{{SCRIPT_FILE_1}}` — 自检清单

| 属性 | 说明 |
|------|------|
| **职责** | {{SCRIPT_FILE_1_ROLE}} |
| **何时读取** | {{SCRIPT_FILE_1_WHEN}} |
| **内容格式** | `- [ ] 可用是/否直接判断的句子`（共 ≥ 10 条）|

---

## 七、工程化保障

### 7.1 坏案例回填机制

> 触发词：`{{BAD_CASE_TRIGGER_1}}` / `{{BAD_CASE_TRIGGER_2}}`

<!-- 说明：设计当用户发现输出质量不达标时的补救流程 -->

| 步骤 | 操作 |
|------|------|
| Step 1 | {{BAD_CASE_STEP_1}} |
| Step 2 | {{BAD_CASE_STEP_2}} |
| Step 3 | {{BAD_CASE_STEP_3}} |

### 7.2 迭代触发词

<!-- 说明：定义 Skill 持续维护时的关键词，让 LLM 知道何时更新知识库 -->

```
「{{ITERATE_TRIGGER_1}}」→ {{ITERATE_ACTION_1}}
「{{ITERATE_TRIGGER_2}}」→ {{ITERATE_ACTION_2}}
「{{ITERATE_TRIGGER_3}}」→ {{ITERATE_ACTION_3}}
```

---

## 八、与 AI 的逐步交互脚本

<!-- 说明：本章是「怎么一步一步跟 AI 对话把 Skill 做出来」的完整操作手册 -->
<!-- 格式：你说什么 → AI 做什么 → 预期结果 → 验证方法 → 通过才继续 -->

### Step 0：建目录骨架

**你说：**
```
帮我在 .catpaw/skills/ 下新建一个 skill，名字叫 {{SKILL_NAME}}。
按以下结构创建空文件：
{{DIRECTORY_TREE}}
```

**AI 做：** 创建全部空文件。

**验证方法：** 在 IDE 文件树展开目录，确认文件数量正确。

---

### Step 1：填充第一个核心子文件

**你说：**
```
{{STEP_1_USER_PROMPT}}
```

**AI 做：** {{STEP_1_AI_ACTION}}

**预期结果：** {{STEP_1_EXPECTED}}

**验证方法：** {{STEP_1_VERIFY}}

---

### Step {{N}}：生成 SKILL.md 主文件

**你说：**
```
读取以下文件：
- {{SKILL_NAME}}/templates/skill-md-template.md（结构模板）
- {{SKILL_NAME}}/references/{{REF_FILE_1}}（核心规范）
- {{SKILL_NAME}}/examples/{{EXAMPLE_GOOD}}（质量锚点）

生成 {{SKILL_NAME}}/SKILL.md 的完整内容，支持以下流程：
1. {{FLOW_1_NAME}}：{{FLOW_1_GOAL_SHORT}}
2. {{FLOW_2_NAME}}：{{FLOW_2_GOAL_SHORT}}
3. {{FLOW_3_NAME}}：{{FLOW_3_GOAL_SHORT}}

所有 Loop 节点必须用伪代码，不得用自然语言箭头。
```

**验证方法：**
- Ctrl+F 搜索 `->` 箭头，数量应为 0
- 确认所有流程都有步骤清单表格

---

## 九、契约与安全（000 对齐）

### 9.1 schema.json 草案

基于 `templates/schema-template.json` 填充：

- `inputs` / `outputs` / `preconditions` / `post_validations` / `fallbacks`
- `error_codes`：E001–E005
- `security.permissions` / `security.restrictions`

### 9.2 hooks 规划

| 钩子 | 职责 |
|------|------|
| pre-execution | 参数校验、前置条件、执行计划摘要 |
| post-execution | 标准 outputs 摘要 |

### 9.3 输出格式

流程结束输出符合 `templates/output-summary-template.md` 与 `schema.json#outputs`。

---

*文档版本：v2.0 | 模板版本：2.0 | 2026-07-12*
