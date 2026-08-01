# 优质 Skill 案例节选

> 来源：`interview-qa-builder/SKILL.md`（已实现并通过冒烟测试的 Skill）  
> 用途：`skill-builder` 的 `build` 流程在生成 SKILL.md 前读取本文件，作为质量上界的 Few-shot 锚点。

---

## 片段一：yaml 元数据块

```yaml
---
name: "interview-qa-builder"
description: |
  面试问答迭代助手。读取 mrn-zhenguo-im 仓库代码和候选人简历，
  为 问答.md 中空白或深度不足的问题补充高质量答案。
  支持三种模式：
  1. 指定方向填写：「补充答案」「填写方向X的答案」「帮我补充这道题」「备考IM项目」
  2. 模拟追问检验缺口：「模拟追问」「追问我一下」「压力测试方向X」
  3. 全量扫描批量填充：「扫描空白答案」「迭代问答」「面试备考」「批量填写」
  当用户说「补充答案」「填写问答」「帮我补充」「模拟追问」「追问我一下」「扫描空白」
  「迭代问答」「面试备考」「备考IM项目」「这道题被追问了」时激活。
version: "1.0.0"
author: "cenyilin"
timeout: 600
retry: 2
parameters:
  - name: "direction"
    type: "string"
    description: "指定要迭代的深挖方向编号或关键词，如 '方向四' 或 'IMSDK'；不填则由 scan 流程自动发现"
  - name: "mode"
    type: "string"
    enum: ["fill", "simulate", "scan"]
    default: "fill"
    description: "fill=填写答案, simulate=模拟追问找缺口, scan=扫描全部空白"
---
```

**✅ 好在哪里**：

1. **`description` 在末尾枚举了完整触发词**：不只说「当用户想填写答案时」，而是逐条列出 9 个具体字符串。CatPaw 激活时能精确匹配意图，不会漏触发或误触发。
2. **`parameters[].enum` 有明确的值域约束**：`["fill", "simulate", "scan"]` 三个值，`description` 里对每个值的含义都有说明（`fill=填写答案, simulate=...`），LLM 不会猜错 mode 的语义。
3. **`description` 中列出了模式入口触发词**：每种模式在 description 里都有示例触发词，用户说「模拟追问」时 LLM 能直接知道要进 simulate 模式。
4. **`timeout: 600` 合理设置**：该 Skill 需要读代码/写文件，操作耗时较长，600 秒比默认值更宽松，避免超时失败。

---

## 片段二：fill 流程步骤清单表格

```markdown
| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|-----------|
| Step 1 🔒 | 读取 `references/resume.md` + `references/depth-directions.md`，建立候选人背景和方向考察点上下文 | 两文件读完 | 读取失败 → 检查路径后重试；`resume.md` 为空 → 直接读仓库根目录 `简历.md` 临时代替 |
| Step 2 🔒 | 读取 `references/repo-structure.md`，确认本次方向涉及的关键代码文件路径 | 路径表加载完成 | — |
| Step 3 🔒 | 读取 `resources/code-location-map.json`，获取「本次每道题 → 代码文件路径」的映射 | 映射加载完成 | 映射中找不到某题路径 → 用 `codebase_search` 探索仓库 → 找到后将新路径补入 JSON → 继续 |
| Step 4 🔒 | 按映射逐题读取对应代码文件（`read_file` 精准定位关键函数/类），提取与答案直接相关的实现细节 | 每道题至少有 1 处代码佐证（类名/方法名/文件路径） | `grep_search` 无结果 → 换关键词重试 → 仍无结果 → 标注「代码中未找到，需手动补充」，不得猜测 |
| Step 5 🔒 | 读取 `references/answer-patterns.md` + `examples/good-answer-sample.md` + `examples/bad-answer-sample.md`，按 STAR 变体骨架起草每道题的答案 | 草稿完成，结构符合：背景铺垫 → 方案核心 → 代码细节 → 亮点收尾 | — |
| Step 6 🔒 | 读取 `scripts/qa-self-check.md`，逐项自检：长度/代码佐证/禁用词/亮点/面试人称 | 全部 10 条自检通过 | 不通过 → 修正对应部分 → 重新自检 → 循环直至全部通过 |
| Step 7 | 将通过自检的答案写入 `问答.md` 对应位置（精准替换空白代码块） | 写入完成 | 写入后 `read_file` 回读验证内容存在 → 不存在 → 重试写入，不得跳过 |
| Step 8 | 输出本次迭代摘要：共填写 N 题、所属方向、引用代码文件列表、待完善标注列表 | 摘要输出 | — |
```

**✅ 好在哪里**：

1. **四列结构完整**：「步骤 / 操作 / 完成条件 / Loop 节点」四列都有，LLM 能清楚知道「什么时候算做完」（完成条件），以及「遇到什么情况怎么分支」（Loop 节点）。
2. **完成条件是可判断的标准**：Step 4 的完成条件是「每道题至少有 1 处代码佐证（类名/方法名/文件路径）」，不是「读完代码」这类含糊描述；LLM 能用 is/isn't 直接判断。
3. **Loop 节点有 fallback 设计**：Step 3 中「映射中找不到 → codebase_search → 找到后补入 JSON → 继续」，Step 4 中「仍无结果 → 标注「未找到」，不得猜测」，每个 Loop 都有明确的降级处理，不会死锁。
4. **🔒 标记区分必选/可选**：Step 1~6 标 🔒，LLM 不得跳过；Step 7~8 不标，可在特殊情况下酌情调整。
5. **操作是动词开头的具体描述**：「读取 `references/resume.md` + ...，建立...」，而非「处理一下简历」这类含糊描述。

---

## 片段三：完整 if/while 伪代码 Loop 节点

```pseudo
function run_fill(direction):

  // ── 准备阶段 ──────────────────────────────────
  resume    = read_file("references/resume.md")         // Step 1
  directions = read_file("references/depth-directions.md")
  if resume is empty:
    resume = read_file("简历.md")                       // fallback：降级到根目录

  repo_map  = read_file("references/repo-structure.md") // Step 2
  loc_map   = read_file("resources/code-location-map.json") // Step 3

  questions = extract_blank_questions(direction, "问答.md")

  // ── 逐题填写循环 ──────────────────────────────
  for question in questions:

    // Step 4：定位代码佐证
    path = loc_map[question]
    if path is null:
      path = codebase_search(question.keywords)
      if path is null:
        mark(question, "待完善：代码中未找到")
        continue                                         // 跳过，不卡死
      else:
        loc_map[question] = path                        // 补入映射
    code_evidence = read_file(path, target=question.keywords)

    // Step 5：读取骨架 + Few-shot 样本，起草答案
    patterns    = read_file("references/answer-patterns.md")
    good_sample = read_file("examples/good-answer-sample.md")
    bad_sample  = read_file("examples/bad-answer-sample.md")
    draft = compose_answer(question, code_evidence, patterns, good_sample)

    // Step 6：自检循环
    checklist = read_file("scripts/qa-self-check.md")
    attempts  = 0
    while not self_check_pass(draft, checklist):
      draft    = fix_draft(draft, checklist.failed_items)
      attempts += 1
      if attempts > 3:
        mark(question, "自检超限，需人工审查")
        break                                            // 终止条件：超过 3 次

    if self_check_pass(draft, checklist):
      // Step 7：写入 + 回读验证循环
      retry = 0
      while retry < 3:
        write_to_qa_md(question, draft)
        result = read_file("问答.md", section=question)
        if result contains draft:
          break                                          // 写入成功，退出
        retry += 1
      if retry == 3:
        raise WriteError("写入验证失败，请检查文件权限")
```

**✅ 好在哪里**：

1. **`for` 循环有明确的迭代对象**：`for question in questions`，LLM 知道迭代每道题，不是「处理所有题目」这类含糊描述。
2. **`if path is null` 分支有双层 fallback**：先 `codebase_search`，还找不到才 `mark + continue`；降级链路清晰，不会因为找不到代码就卡死整个循环。
3. **`while` 循环有两种终止条件**：① `self_check_pass(draft, checklist)` 为真时退出；② `attempts > 3` 超限时 `break`；两种条件互补，确保循环必然终止。
4. **`continue` 和 `break` 语义清晰**：`continue` 表示跳过当前题目继续下一题（不中断全局），`break` 表示退出当前 while（超限降级）；两个关键字在不同上下文有不同语义，均标注了注释。
5. **写入验证有 retry 上限**：`while retry < 3`，最多重试 3 次后抛出错误，不无限重试。
