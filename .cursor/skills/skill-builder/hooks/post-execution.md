# post-execution 钩子

> **Harness 专用** — Agent 不读取。三阶段完成后由系统调用一次。

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 计算 `duration_ms` | 已计算 | — |
| Step 2 🔒 | 汇总 artifacts、self_check、warnings | 字段完整 | — |
| Step 3 🔒 | 按 `templates/output-summary-template.md` 输出摘要 | 已展示 | — |

---

## 执行伪代码

```pseudo
function post_execution(result):

  summary = {
    status: result.status,
    mode: result.mode,        // "create" | "iterate"
    phase: "done",
    artifacts: result.artifacts ?? [],
    self_check: result.self_check ?? {},
    warnings: result.warnings ?? [],
    metrics: { duration_ms: ..., files_generated: ... }
  }

  show_output_summary(summary)

  return summary
```
