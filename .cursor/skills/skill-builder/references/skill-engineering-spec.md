# Skill 工程化规范（维护者文档）

> 供 skill-builder **生成目标 Skill** 时参考；**不**要求 Agent 激活时链式读取。  
> 核心指令已内联至 `skill-builder/SKILL.md`；系统流程见 `.harness/`。  
>
> **原则权威**：`references/skill-best-practices.md`（单一职责 / 契约 / 渐进披露 / 结构化 / 可观测；含 skill-builder 代码参照）。  
> 本文是句式、表格、目录、安全等**细则**；与最佳实践冲突时以最佳实践为准。

---

## 规范 1：元数据块格式（yaml 头）

SKILL.md 顶部 yaml 块：**Agent 面**尽量精简；**契约**放 `schema.json`。

**skill-builder 自身（元 Skill）**：

```yaml
---
name: skill-builder
description: 从零创建或迭代已有 Skill 的元工具。触发：…。非触发：…。
version: "2.3.0"
---
```

**一般目标 Skill**：

```yaml
---
name: "skill-name"
description: 一句话能力。触发：…。非触发：…。（3–5 句，不含流程说明）
version: "1.0.0"
---
```

`mode`、`skill_name` 等**调用参数**写入 `schema.json#inputs`，不写入 SKILL yaml（避免常驻上下文膨胀）。

维护者可选在 `metadata.yaml` 记录 `timeout` / `author`；不必塞进 Agent 必读 yaml。

---

## 规范 2：触发词设计原则

触发词是 CatPaw 识别用户意图、激活 Skill 的关键信号。`description` 须**先写激活语义，再附少量示例**，不得只堆砌例句。

### 2.1 description 结构（常驻上下文，宜短）

1. **一句话能力**
2. **触发**：用户意图 + 若干「」例句（≤10 个）
3. **非触发**：仅口头咨询、**不涉及产出文件**的一般任务

流程、模式表、步骤说明 → 放 **SKILL.md 正文**，不要写进 description。

### 2.2 三个覆盖维度

| 维度 | 说明 | 示例 |
|------|------|------|
| 中文口语 | 用户日常说话方式 | `帮我开发一个新 skill` |
| 英文等价 | 技术用户习惯 | `create skill` |
| 模式变体 | 各 mode 的典型说法 | `迭代 skill` / `新建 skill` |

✅ 正确写法：
```
…帮助开发者从零创建或迭代已有 Skill。

激活语义：用户要造新 Skill 或改已有 Skill，并走完澄清→设计→落地时使用。
不激活：仅问概念、单次改一行、无关开发任务。

两种模式：
1. create — 从零新建；示例：「新建 skill」「create skill」
2. iterate — 改已有；示例：「迭代 skill」「update skill」

当用户说「新建 skill」「create skill」「迭代 skill」…时激活。
```

❌ 错误写法：
```
当用户说「词A」「词B」「词C」「词D」「词E」「词F」…（仅列举，无语义）
```
**错误原因**：无语义边界，LLM 无法判断近义/歧义场景；例句过多会挤占 description 篇幅且仍可能漏匹配。

**关键约束**：
- 必须有「激活语义」和「不激活」边界（可简短）
- 示例短语总数 ≥ 5，且出现在末尾「当用户说」句中
- 每个示例是具体字符串；mode 语义与示例分开写
- 禁止「任何关于 xxx 的话都激活」

---

## 规范 3：流程步骤表格规范（四列）

每条流程的步骤清单必须用 Markdown 表格表达，包含以下四列：

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step N 🔒 | 具体操作描述（动词开头） | 明确可判断的完成标准 | 有分支时用伪代码描述；无分支时填 `—` |

✅ 正确写法：

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 读取 `references/spec.md`，加载工程化规范 | 文件读取完成，规范内容加载入上下文 | 读取失败 → 用内置规范继续 |
| Step 2 🔒 | 询问背景：「这个 Skill 解决什么问题？」 | 用户回答包含场景描述 | 回答模糊 → 追问具体化 → 最多追问 2 次 |

❌ 错误写法：

| 步骤 | 操作 |
|------|------|
| 1 | 读取规范文件，然后问用户背景，如果不清楚就再问一遍 |

**错误原因**：
- 缺少「完成条件」列 → LLM 不知道何时推进到下一步
- 缺少「Loop 节点」列 → 分支逻辑混在操作描述里，LLM 容易忽略
- 步骤编号无 `🔒` 标记 → 无法区分必须执行和可选步骤

**关键约束**：
- 必须执行的步骤加 `🔒` 标记
- 「完成条件」列不能为空或填「完成后继续」这类废话，必须是可判断的标准
- 每条流程步骤数量 ≥ 4 步

---

## 规范 4a：澄清对用户说话（逐项 · 自然语言）

多轮澄清时，**对用户的话**与 **对内的 Loop 伪代码** 分开：

- **对内**（步骤表 / loop_guard / `*_record`）：可用字段 id、`pending`、伪代码  
- **对外**（Agent 回复用户）：每轮只问 1 项；人话；可给格式短例；禁止「本轮补这 N 项」+ 字段 id 清单  

✅ 正确（对外）：

```
进入 create 模式，先确认名称。

请提供 Skill 名称（kebab-case，例如 pr-description-builder）：

接下来：这个 Skill 主要解决什么问题？（一两句话即可）
```

❌ 错误（对外）：

```
clarify_record 目前几乎空白。本轮请补这 5 项：
task_scope：…
goal：…
```

**关键约束**（生成目标 Skill 必写进澄清规则）：

- 自检 Loop：`只追问 missing` 且 **每轮最多 1 个**
- 「交互示例」至少一段符合上列正确格式
- 禁止把内部记录名（如 `clarify_record`）当作对用户的催填口令

细则权威：`skill-best-practices.md` §1.6。

---

## 规范 4：Loop 节点必须用伪代码

所有 Loop 节点、分支判断、重试逻辑，必须用伪代码（`for`/`if`/`while`/`assert`）表达，**禁止使用自然语言箭头**。

**原因**：自然语言描述的 Loop（如「找不到 → 换关键词」）对 LLM 来说是可选建议；伪代码结构在 LLM 解析时具有更强的指令语义，执行遵从率显著更高。

✅ 正确写法（伪代码）：
```pseudo
// 代码查找 Loop
for each question in target_questions:
    path = location_map[question]
    if path is None:
        path = codebase_search(question.keywords)
        if path is None:
            mark(question, "待完善")
            continue    // 跳过，不猜测
    evidence = read_file(path)
    if evidence is empty:
        path = grep_search(alternative_keywords)
        if still_empty:
            mark(question, "待完善")
            continue
```

❌ 错误写法（自然语言箭头）：
```
代码找不到 → 换关键词 grep_search → 仍无结果 → 标注「未找到」继续
```

**必须包含的要素**：
1. 明确的循环结构（`for` / `while`）
2. 分支条件（`if ... else ...`）
3. 终止条件（`break` / `continue` / `return` / `max_retry`）
4. 降级处理（当条件不满足时的 fallback，不能让流程死锁）

---

## 规范 5：子文件职责划分（四类目录）

一个工程化 Skill 的子文件应按以下四类目录组织，每类有明确的职责边界：

| 目录 | 职责 | 何时读取 | 典型文件 |
|------|------|---------|---------|
| `references/` | 结构化背景知识，静态输入 | 流程开始时必读，提供上下文框架 | `spec.md` / `patterns.md` / `directions.md` |
| `templates/` | 骨架模板，含占位符 | 生成内容时读取，作为填充骨架 | `design-doc-template.md` / `skill-md-template.md` |
| `examples/` | Few-shot 示例，质量锚点 | 生成内容前读取，上下界约束 | `good-sample.md` / `bad-sample.md` |
| `scripts/` | 自检执行文档 | 输出内容前读取，逐项核对 | `self-check.md` |

✅ 正确做法：
```
skill-name/
├── SKILL.md
├── references/      # 背景知识，LLM 流程开始读
├── templates/       # 骨架模板，生成前读
├── examples/        # Few-shot，生成前读作质量锚
└── scripts/         # 自检，输出前执行
```

❌ 错误做法：
```
skill-name/
├── SKILL.md
├── data.md          # 职责不明，什么都往里放
└── prompt.md        # 把 prompt 和结构混在一起
```

**关键约束**：
- 每个子文件在 `SKILL.md` 的「子文件索引」表中必须有对应行
- 「何时读取」列不能为空
- `references/` 中的文件是只读背景，不由 LLM 修改（除非有明确的「更新」流程）
- 所有文件路径引用使用相对路径（相对 Skill 根目录），如 `references/spec.md`

---

## 规范 6：输出契约

每个流程结束必须输出符合 `schema.json#outputs` 的标准摘要（见 `templates/output-summary-template.md`）：

- `status`：success | partial | failed | cancelled
- `artifacts`：产出文件列表
- `self_check`：自检通过/失败条目
- `warnings`：非阻塞告警
- `metrics`：duration_ms、files_generated

✅ 流程结束时执行 `hooks/post-execution.md`。  
❌ 仅说「完成了」而不输出结构化摘要。

---

## 规范 7：安全边界

- 写文件前必须展示 diff 并等用户确认（update/build 覆盖场景）
- 禁止静默修改`constitution.yaml`
- `schema.json#security.restrictions` 必须列出本 Skill 的禁止项

---

## 规范 8：三体最小集

新 Skill 至少包含：

```
skill-name/
├── SKILL.md
├── schema.json          # 契约
├── scripts/             # 自检（skill-self-check.md 或 validate 脚本）
└── hooks/               # 建议：pre-execution + post-execution
```

build 流程必须生成 `schema.json`；post_validation 建议运行 `validate-skill-structure.ts`。

---

*文档版本：v2.1 | 2026-07-14 | 维护：每次规范升级后同步更新本文件*
