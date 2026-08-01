# 反例案例（反向 Few-shot）

> 用途：`skill-builder` 的 `build` 流程在 `scripts/skill-self-check.md` 自检阶段读取本文件，  
> 对照检查生成的 SKILL.md 是否存在类似错误模式。
>
> 四个反例覆盖最常见的四类质量问题：
> 1. 用自然语言箭头描述 Loop
> 2. 流程步骤缺少完成条件列
> 3. 触发词过于宽泛
> 4. 澄清时用字段 id 清单催填

---

## 反例 1：自然语言箭头描述 Loop

### ❌ 原始写法（不可接受）

```markdown
### 步骤清单

| 步骤 | 操作 | Loop 节点 |
|------|------|----------|
| Step 3 | 读取代码文件，找到问题对应的实现细节 | 找不到 → 换关键词 grep_search → 仍无结果 → 标注「未找到」继续下一题 |
| Step 4 | 起草答案，确保 STAR 结构完整 | 答案太短 → 补充细节 → 再看一遍 |
| Step 5 | 执行自检清单，通过后写入文件 | 不通过 → 修正 → 重检 |
```

### ❌ 问题在哪

1. **自然语言箭头不是指令**：`找不到 → 换关键词 → 仍无结果 → 标注` 对 LLM 来说是描述性建议，不是需要执行的控制流。LLM 在实际执行时极可能直接跳过，或者随意解释「仍无结果」的判断标准。
2. **没有终止条件**：`答案太短 → 补充细节 → 再看一遍` 没有说「看几遍」「多长算足够」，LLM 可能无限循环，也可能补一次就停。
3. **缺少降级处理**：没有说「如果最终还是找不到怎么办」（应该是 `mark + continue`），LLM 遇到死角会猜测或编造答案。
4. **箭头链无法表达嵌套分支**：`→` 是线性的，无法表达「如果 A 则 B，如果不是 A 则 C」这种 if-else 结构。

### ✅ 应该怎么改（伪代码写法）

```pseudo
// Step 3：定位代码 Loop
for each question in target_questions:
    path = location_map[question]
    if path is None:
        path = codebase_search(question.keywords)
        if path is None:
            path = grep_search(alternative_keywords)
            if path is None:
                mark(question, "待完善：代码中未找到")
                continue    // 跳过，不猜测，不卡死
    evidence = read_file(path)

// Step 4：起草答案，无需 Loop（单次生成）
draft = compose_answer(question, evidence, patterns)
if len(draft) < 100:
    draft = expand_answer(draft, missing_elements=["code_detail", "tradeoff"])
// 不做 while 循环，起草是单次操作，质量控制由 Step 5 自检承担

// Step 5：自检循环
attempts = 0
while not self_check_pass(draft, checklist):
    draft = fix_draft(draft, checklist.failed_items)
    attempts += 1
    if attempts >= 3:
        mark(question, "自检超限，需人工审查")
        break    // 明确终止条件，最多 3 次
```

---

## 反例 2：步骤表格缺少「完成条件」列

### ❌ 原始写法（不可接受）

```markdown
### 步骤清单

| 步骤 | 操作 |
|------|------|
| 1 | 读取参考文件，了解背景知识 |
| 2 | 询问用户需求 |
| 3 | 生成设计文档 |
| 4 | 让用户确认后开始生成文件 |
| 5 | 逐文件生成，完成后告知用户 |
```

### ❌ 问题在哪

1. **缺少「完成条件」列**：LLM 不知道「读取参考文件」何时算读完——是文件存在就算完，还是需要解析出关键字段？LLM 可能读一眼就继续，也可能反复读。
2. **缺少「Loop 节点」列**：所有步骤看起来都是线性的，但实际上 Step 2（询问需求）可能需要追问，Step 4（用户确认）可能需要等待用户修改后再确认——这些隐含的循环无处体现。
3. **步骤编号无 🔒 标记**：无法区分「必须执行」和「可选执行」的步骤，LLM 可能跳过关键准备步骤。
4. **操作描述太模糊**：「读取参考文件，了解背景知识」——读哪个文件？了解什么背景？LLM 需要自行推断，质量无法保证。

### ✅ 应该怎么改（完整四列表格）

```markdown
### 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 读取 `references/skill-engineering-spec.md`，加载工程化规范作为约束框架 | 规范文件读取完成，5 条规范内容已加载入上下文 | 读取失败 → 用内置规范继续，并告知用户文件缺失 |
| Step 2 🔒 | 询问用户背景：「这个 Skill 要解决什么问题？在什么场景下会用到？」 | 用户回答包含「具体场景」或「问题描述」两个要素 | 用户回答模糊 → 再追问「能描述一个具体触发场景吗？」，最多追问 2 次 |
| Step 3 🔒 | 基于需求生成设计文档（读取 `templates/design-doc-template.md` 填充占位符） | 设计文档包含：流程分支总览 + 至少 2 条流程步骤清单（含 Loop 伪代码）| 步骤 < 4 条 → 拆分粒度更细，直到每步可独立验证 |
| Step 4 🔒 | 展示设计文档，等待用户确认：「设计方案是否符合预期？确认后开始生成文件。」| 用户明确说「确认」或「开始」 | 用户有修改意见 → 定位对应章节局部修改 → 再次等待确认 |
| Step 5 | 按设计方案遍历目录，逐文件生成（每文件前询问约束，后等待用户确认） | 全部文件写入完成，用户逐一确认 | 写入失败 → 重试一次；仍失败 → 标注并跳过 |
```

---

## 反例 3：触发词过于宽泛

### ❌ 原始写法（不可接受）

```yaml
description: |
  当用户说任何关于开发 Skill 的话时激活。
  或者当用户想创建一个新工具时也可以激活。
  总之，凡是想构建 AI 辅助工具的场景都可以用。
```

```markdown
**触发场景**：用户有构建新工具的想法时。
```

### ❌ 问题在哪

1. **「任何关于 XXX 的话」等于无限制**：CatPaw 无法做精确意图匹配，几乎所有对话都可能触发，导致频繁误激活。
2. **「总之，凡是...」是 LLM 的免责模糊**：这类描述告诉 LLM「随便激活都行」，LLM 会在不相关的对话中也尝试激活 Skill。
3. **没有具体触发字符串**：CatPaw 的 Skill 激活是基于关键词/意图匹配的，「有构建新工具的想法」不是可以匹配的字符串。
4. **触发词未区分模式**：用户说「帮我写 SKILL.md」应该进 build 模式，说「设计一个 skill」应该进 design 模式——宽泛描述无法区分。

### ✅ 应该怎么改（具体触发词列表）

```yaml
description: |
  开发 Skill 的元 Skill。帮助开发者从零构建符合 CatPaw 工程化标准的新 Skill，
  包含需求澄清、设计方案生成、SKILL.md 逐步构建三个阶段。
  支持三种模式：
  1. clarify：澄清需求（「帮我开发一个新 skill」「我想做一个 skill」「create skill」）
  2. design：生成设计方案（「设计一个 skill」「给我写设计文档」）
  3. build：生成文件（「帮我写 SKILL.md」「开始生成」）
  当用户说「帮我开发一个新 skill」「新建 skill」「我想做一个 skill」「设计一个 skill」
  「create skill」「build a new skill」「从零构建 skill」「帮我写 SKILL.md」时激活。
```

**改写说明**：
- 每个触发词是**具体的字符串**，不是模糊描述
- 触发词覆盖**中文口语**（「帮我开发一个新 skill」）、**英文**（「create skill」）、**简短变体**（「新建 skill」）三个维度
- 不同模式的触发词在 description 中**明确标注**对应模式
- 末尾**重复列出**所有触发词（供 CatPaw 激活时关键词匹配）
- 总计 **8 个**触发词，满足「触发词 ≥ 5 个」的规范要求

---

## 反例 4：澄清时用字段 id 清单催填

### ❌ 原始写法（不可接受）

```markdown
clarify_record（new）目前几乎空白。本轮请补这 5 项：

task_scope：本次是 code / skill / agent / general 哪一类？
goal：一句话目标是什么？
background：为什么现在要做？
scope：本次包含哪些能力/模块？
acceptance：怎样算验收通过？
若已知，也可顺带写上 non_goals、constraints。
```

### ❌ 问题在哪

1. **同轮批问**：用户一次要答多项，违背「每轮 1 问」。
2. **对内命名对外用**：`task_scope` / `clarify_record` 是状态机键名，不是对话用语。
3. **顺带写选填**：把可选字段堆进同一轮，加重负担。

### ✅ 应该怎么改

```markdown
进入 new 模式，先确认任务类型。

这次方案主要落在哪一类？业务代码（code）/ Skill（skill）/ Agent（agent）/ 通用（general）：

接下来：用一句话说说要达成的目标。
```
