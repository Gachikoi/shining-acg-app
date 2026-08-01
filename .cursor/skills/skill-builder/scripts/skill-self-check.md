# Skill 结构与契约自检（Harness / CI）

> **不由 Agent 自觉执行**。由 Harness、`deno task` 或 CI 在 build 后调用。  
> Agent 仅需在完成后**告知用户**可运行 validate 命令。  
> 原则对照：`references/skill-best-practices.md`。

---

## 自检清单

### A. 最佳实践原则

- [ ] A1：`description` 含定义 + 触发 + 不触发边界（单一职责）
- [ ] A2：存在 `schema.json`，且含 `inputs`、`outputs`（契约优先）
- [ ] A3：目标 `SKILL.md` yaml **不含** `parameters`（参数在 `schema.json#inputs`）
- [ ] A4：`SKILL.md` **不含**「执行 hook / 跑 validate」类 Agent 义务句
- [ ] A5：流程有可判定的阶段完成条件；多轮有确认门禁（结构化）
- [ ] A6：至少一段交互示例或可导出摘要路径（可观测）
- [ ] A7：含澄清时：每轮最多 1 问、用人话；交互示例非字段 id 清单催填（best-practices §1.6）

### B. 结构与工程化细则

- [ ] B1：`SKILL.md` yaml 块以 `---` 包裹；`name` 为 kebab-case
- [ ] B2：触发示例短语 ≥ 5（可在 description 或正文示例中）
- [ ] B3：`schema.json` 含 `security.restrictions`（建议另有 `preconditions`）
- [ ] B4：目标含工作流程（步骤表或等价动作表）
- [ ] B5：`description` 宜短，不含流程说明书（流程在正文）
- [ ] B6：`deno run -A …/validate-skill-structure.ts <dir>` exit 0

### C. 级别声明（design 文档或 schema description 中可选）

- [ ] C1：标明 L1 / L2 / L3；若声称 L3，应有状态持久化与 Loop/校验脚本之一

---

## 命令

```bash
deno run -A .cursor/skills/skill-builder/scripts/validate-skill-structure.ts <skill_dir>
```
