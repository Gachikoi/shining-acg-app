# 000 标准 ↔ Cursor Skill 对照表

> 将 `000-一个好的skill应该是怎样的.md` 的生产级标准映射到 Cursor/CatPaw 可落地形态。

---

## 三体结构映射

| `000` 层 | Cursor 落地 | skill-builder 中的文件 |
|----------|-------------|------------------------|
| 定义层 `schema.json` | `schema.json` + yaml frontmatter | `schema.json`、`SKILL.md` 头部 |
| 定义层 `metadata.yaml` | `metadata.yaml` | `metadata.yaml` |
| 定义层 `examples/` | `examples/` | `examples/good-skill-sample.md` 等 |
| 执行层 `handler.py` | `SKILL.md` 伪代码 + `scripts/*.ts` | `references/flows/*.md`、`validate-skill-structure.ts` |
| 执行层 `validators/` | `scripts/skill-self-check.md` + validate 脚本 | 自检 18 条 + TS 校验 |
| 执行层 `fallbacks/` | 伪代码 + `schema.json#fallbacks` | 各 flow 伪代码、`schema.json` |
| 治理层 `tests/` | `tests/` fixtures + e2e 场景 | `tests/` |
| 治理层 `hooks/` | `hooks/*.md` | `hooks/pre-execution.md`、`post-execution.md` |
| 治理层 `docs/` | `docs/` | `docs/README.md`、`DESIGN.md` |

---

## 五大原则映射

| 原则 | Cursor 落地方式 |
|------|----------------|
| 单一职责 | 一个 Skill 一个领域；skill-builder 只管 Skill 工程化 |
| 契约优先 | `schema.json` 定义 I/O；yaml parameters 供 Agent 读 |
| 可观测性 | post-execution 标准摘要；步骤表完成条件 |
| 自愈性 | fallbacks 表 + 伪代码 max_retry |
| 可组合性 | metadata.dependencies；标准 outputs 供 harness 解析 |

---

## 错误码与降级

| 错误码 | 条件 | 降级动作 |
|--------|------|----------|
| E001 | 路径/文件不存在 | 询问用户重新提供；update 最多重试 2 次 |
| E002 | 自检或结构校验失败 | 修正重试 ≤2；仍失败 → partial |
| E003 | 写入失败 | 重试 1 次 → failed |
| E004 | 参数非法 | hard_fail_and_clarify |
| E005 | 用户取消 | status=cancelled |

---

*文档版本：v1.1 | 2026-07-14*
