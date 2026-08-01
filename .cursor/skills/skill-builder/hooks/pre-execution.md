# pre-execution 钩子

> **Harness 专用** — Agent 不读取。见 `.harness/flow.yaml`。

---

## 步骤清单

| 步骤 | 操作 | 完成条件 | Loop 节点 |
|------|------|---------|----------|
| Step 1 🔒 | 解析 `mode`（默认 `create`）、`skill_name`、`target_skill_path` | 参数已解析 | 非法 enum → E004 |
| Step 2 🔒 | 若未指定 `mode`，根据触发词推断 create / iterate | mode 已确定 | 仍模糊则 clarify init 后由 `ask_question` 处理 |
| Step 3 🔒 | iterate 且已给 `target_skill_path`：校验路径存在 | 通过或留待 clarify | 不存在 → E001 |
| Step 4 🔒 | 运行 `session reset --mode <mode>`（清空三阶段 `.meta/*_state.json` 并 `clarify init`） | 运行时元数据已重置 | 失败 → E004 |
| Step 5 🔒 | 运行 `clarify_loop.py clarify status`，注入 `{{CLARIFY_STATE}}` | Agent 收到 `next_action` | — |
| Step 6 | 记录 `started_at`，输出执行计划摘要 | 已记录 | — |

---

## 每轮用户回复后（clarify 阶段）

| 步骤 | 操作 |
|------|------|
| R1 | `clarify_loop.py clarify parse --text "<用户原文>"`（或 `apply --id --value`） |
| R2 | `clarify_loop.py clarify next`（幂等；parse 已含 next 时可跳过） |
| R3 | `clarify_loop.py clarify status` → 注入下一轮 `{{CLARIFY_STATE}}` |
| R4 | 若 `can_exit === true` → `design init --from-clarify`，切换 `{{DESIGN_STATE}}` |

---

## mode 推断

| 用户意图（语义） | mode | 示例短语 |
|-----------------|------|---------|
| 从零新建 Skill | create | 新建 / create / 从零构建 |
| 改已有 Skill | iterate | 迭代 / update / 升级 / 加流程 |
