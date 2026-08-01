# 坏案例回填流程

> 触发词：`这个 Skill 有问题：XXX` / `生成的 Skill 不符合规范` / `回填反例：XXX`

当用户发现生成的 Skill 存在质量问题时，执行以下步骤。

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 定位 SKILL.md 或对应子文件中的问题点 | 问题文件和位置已确定 | 定位失败 → 询问用户提供路径 |
| Step 2 🔒 | 读取 `references/skill-engineering-spec.md`，确认违反哪条规范 | 规范条目已标注 | 读取失败 → 用内置 8 条规范对照 |
| Step 3 🔒 | 读取 `examples/bad-skill-sample.md`，判断错误类型 | 错误类型已分类 | — |
| Step 4 🔒 | 修正对应文件；写文件前展示 diff 等用户确认 | 用户确认后写入 | 用户拒绝 → 根据反馈重新修正 |
| Step 5 🔒 | 执行 `scripts/skill-self-check.md` 18 条自检 | 全部通过或列出剩余项 | 失败 → 修正重试，max_retry=2 |
| Step 6 | 运行 `deno run -A scripts/validate-skill-structure.ts <skill_dir>` | 脚本通过或记录 warnings | — |
| Step 7 | 若为新类型反例，追加到 `examples/bad-skill-sample.md` | 已追加或用户选择跳过 | — |
| Step 8 | 执行 `hooks/post-execution.md` 输出摘要 | 摘要已输出 | — |

---

## 执行伪代码

```pseudo
function run_backfill(issue_description, target_skill_path):

  problem = locate_issue(issue_description, target_skill_path)
  if problem is None:
    target_skill_path = ask("请提供有问题的 Skill 的 SKILL.md 路径")
    problem = locate_issue(issue_description, target_skill_path)

  spec = read_file("references/skill-engineering-spec.md") ?? BUILTIN_SPEC
  bad_sample = read_file("examples/bad-skill-sample.md")
  violation = match_violation(problem, spec, bad_sample)

  fixed_content = fix_content(problem.file, problem.location, violation)
  show_diff(problem.file, fixed_content)
  if not wait_for_user_confirm():
    return post_execution({ status: "cancelled", mode: "backfill" })

  write_file(problem.file, fixed_content)

  attempts = 0
  while attempts < 3:
    failed = self_check_18_items(problem.skill_dir)
    if len(failed) == 0:
      break
    fixed_content = fix_from_checklist(failed)
    write_file(problem.file, fixed_content)
    attempts += 1

  run_validate_script(problem.skill_dir)

  if violation.is_new_type:
    if ask("是否将此类错误追加到 bad-skill-sample？"):
      append_to_bad_sample(violation)

  return post_execution({
    status: "success" if len(failed) == 0 else "partial",
    mode: "backfill",
    artifacts: [{ path: problem.file, type: "skill_md" }]
  })
```
