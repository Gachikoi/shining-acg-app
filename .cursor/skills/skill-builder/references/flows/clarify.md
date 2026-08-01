# 流程：clarify（需求澄清）

> 阶段一。create 与 iterate **共用本流程**，按 `mode` 分支。完成后进入 design，**不**在此调用 post-execution。

**目标**：

- **create**：收集新 Skill 的背景、需求、目标、参考资料
- **iterate**：读取现有 Skill，收集变更需求

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 读取 `references/skill-engineering-spec.md` | 规范加载完成 | 读取失败：用 BUILTIN_SPEC 继续并 warning |
| Step 2 🔒 | 读取注入的 `next_action`；按 **澄清表达规范**（人话、每轮 1 问）执行提问或确认 | 本轮 `next_action` 已对用户说出 | 禁止同轮批问多字段 id |
| Step 3 🔒 | 用户回答后交 Harness parse；脚本更新 pending，下一轮再注入 | 该项写入 requirements | 模糊则同项再问，max_retry=2 |
| Step 4 | 必填齐后输出人话「需求确认摘要」；iterate 含现有状态 + 变更意图 | 摘要完整 | — |
| Step 5 | 等待用户确认 | `user_confirmed` | 有修改则更新并重新等待 |

---

## 执行循环伪代码

```pseudo
function run_clarify(mode, params):

  // Harness 注入 next_action；Agent 只问一项
  while true:
    action = state.next_action
    if action.type == "ask_question":
      say_natural(mode_hint + action.message)   // 禁止一次列出多个字段 id
      reply = wait_for_user()
      harness.parse(reply)                      // 更新 .meta，不算 Agent 义务
      continue
    if action.type == "wait_for_confirmation":
      show_human_summary(state.clarify_record)
      reply = wait_for_user()
      if confirmed(reply):
        harness.confirm()
        break
      else:
        harness.apply_corrections(reply)
        continue
    if action.type == "exit_to_design":
      break

  return { clarify_summary: state.clarify_record, mode }
```
