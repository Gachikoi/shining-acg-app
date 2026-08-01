# skill-builder 设计决策

## 核心分工（v2.5）

| 层 | 职责 | 位置 |
|----|------|------|
| **Harness** | 流程编排、状态注入、pre/post hook、校验命令 | `.harness/`、`hooks/` |
| **Loop 脚本** | 状态持久化、`next_action` 计算、退出条件 | `.meta/`、`scripts/*.py` |
| **契约** | inputs/outputs/preconditions/security | `schema.json` |
| **AI 指令** | 执行 `next_action`、生成内容；**不维护状态** | `SKILL.md` |

> Agent 是状态机执行者：读 `{{CLARIFY_STATE}}` 等注入块，按 `next_action.type` 行动。

**原则权威**（自身与生成物）：`references/skill-best-practices.md`。

## 两种模式 × 三阶段

- **create** / **iterate**：`requirements_schema.json` 定义各模式需求项
- **clarify → design → build**：`loop_guard.py` 控制阶段内循环；`can_exit` 门禁阶段切换

## Loop Engineering

```
Harness: init → status → inject
Agent:   执行 next_action → 与用户对话
Harness: parse/apply → next → status → inject
直到 can_exit → 下一阶段 init
```

---

*v2.5.1 | 2026-07-14*
