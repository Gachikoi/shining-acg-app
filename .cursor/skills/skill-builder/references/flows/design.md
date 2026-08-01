# 流程：design（设计方案生成）

> 阶段二。create 产出完整设计文档；iterate 产出**差量**设计文档。完成后进入 build，**不**在此调用 post-execution。

**目标**：

- **create**：含 schema、hooks、目录结构的完整设计文档
- **iterate**：新增项 / 修改项 / 不变项 三类差量方案

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 读取 `templates/design-doc-template.md` | 模板加载完成 | 失败则用内置骨架 |
| Step 2 🔒 | 读取 `skill-engineering-spec.md` + `skill-000-mapping.md` + `good-skill-sample.md` | 加载完成 | — |
| Step 3 🔒 | 基于 clarify 摘要推断流程分支与目录 | 各流程/子文件已填写 | 无法推断则询问用户 |
| Step 4 🔒 | 生成步骤清单（≥4 步/流程）、伪代码化 Loop | 无 `→` 箭头 Loop | 不足 4 步则拆分，max_rounds=3 |
| Step 5 🔒 | **create**：填充完整契约章节；**iterate**：生成差量清单（add/modify/keep） | 文档完整 | — |
| Step 6 | 展示设计文档，等待用户确认 | 用户确认 | 有修改则局部更新 |
| Step 7 | 返回 `design_doc` 供 build 使用 | 对象已构造 | — |

---

## 执行循环伪代码

```pseudo
function run_design(mode, clarify_result):

  template = read_file("templates/design-doc-template.md") ?? BUILTIN_TEMPLATE
  spec = read_file("references/skill-engineering-spec.md")
  summary = clarify_result.clarify_summary

  flows = infer_flows_from_summary(summary)
  for each flow in flows:
    ensure_steps_ge_4_and_pseudocode(flow)

  if mode == "iterate":
    design_doc = build_delta_design(
      template, summary, summary.existing_skill,
      add=..., modify=..., keep=...
    )
  else:
    directory = infer_directory(flows, summary)
    schema_draft = fill_template("templates/schema-template.json", summary)
    design_doc = merge_full_design(template, flows, directory, schema_draft)

  show_design_doc(design_doc)

  while user_not_confirmed:
    response = wait_for_user()
    if response in ["确认", "开始", "没问题"]:
      break
    else:
      update_section(locate_section(response), response)

  return { design_doc, mode, cancelled: false }
```
