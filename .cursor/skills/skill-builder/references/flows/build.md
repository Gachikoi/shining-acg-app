# 流程：build（逐步生成文件）

> 阶段三。create 生成全部文件；iterate 仅处理差量变更。完成后由 `main` 调用 `hooks/post-execution.md`。

**目标**：

- **create**：生成 `SKILL.md`、`schema.json` 及全部子文件
- **iterate**：按差量方案新增/修改文件，跳过不变项；覆盖前展示 diff

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 读取 design 产出，提取目标目录与文件列表 | 列表加载完成 | — |
| Step 2 🔒 | 读取模板与 good-sample | 加载完成 | — |
| Step 3 🔒 | **create**：生成并写入 `SKILL.md` + `schema.json`；**iterate**：按差量修改/新增，diff 确认后写入 | 文件写入成功 | 失败重试 1 次 |
| Step 4 🔒 | 18 条自检 + `validate-skill-structure.ts` | 通过或 partial | max_retry=2 |
| Step 5 | 遍历待生成子文件（create=全部，iterate=仅 add 项） | 处理完毕 | 每文件前询问约束 |
| Step 6 | 再次运行 validate；返回 result 给 `main` | result 已构造 | — |

---

## 执行循环伪代码

```pseudo
function run_build(mode, design_result):

  design_doc = design_result.design_doc
  skill_dir = design_doc.target_dir
  artifacts = []

  if mode == "create":
    file_list = extract_all_files(design_doc)
    skill_md = generate_skill_md(...)
    write_with_retry(skill_dir + "/SKILL.md", skill_md)
    write_with_retry(skill_dir + "/schema.json", generate_schema(...))
    artifacts.push("SKILL.md", "schema.json")
  else:
    file_list = design_doc.add_files  // 仅新增子文件；SKILL.md/schema 走差量
    if design_doc.modify_skill_md:
      new_md = apply_delta(read_file(design_doc.target_path), design_doc.delta)
      show_diff(...)
      if user_confirmed:
        write_with_retry(design_doc.target_path, new_md)
        artifacts.push("SKILL.md")
    // schema 差量同理

  self_check_and_validate(skill_dir, max_retry=2)

  for each sub_file in file_list:
    if sub_file already_handled:
      continue
    constraints = ask(f"即将生成 {sub_file.path}，有没有特殊要求？")
    content = generate_sub_file(sub_file, constraints, design_doc)
    if write_with_retry(skill_dir + "/" + sub_file.path, content):
      artifacts.append(sub_file.path)
      if not wait_for_user("继续下一个？"):
        break

  run_validate_script(skill_dir)

  return {
    status: "success" if all_pass else "partial",
    artifacts,
    self_check: {...},
    new_skill_created: (mode == "create")
  }
```
