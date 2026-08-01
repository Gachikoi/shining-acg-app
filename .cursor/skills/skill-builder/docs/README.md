# skill-builder 使用说明

| 文档 | 受众 | 内容 |
|------|------|------|
| [../references/skill-best-practices.md](../references/skill-best-practices.md) | 全员 / 生成 Skill | **最佳实践权威**：原则 + 实现 + skill-builder 代码参照 |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | 维护者 / Harness 集成 | 目录结构、文件分类、完整流程与每步读写的文件 |
| [DESIGN.md](./DESIGN.md) | 维护者 | v2.5 设计决策与四层分工 |

## 分工

| 谁 | 做什么 |
|----|--------|
| **Agent** | 读 `SKILL.md`，与用户走完 clarify → design → build |
| **Harness / CI** | 读 `.harness/flow.yaml`，跑 hooks 与 `validate-skill-structure.ts` |

## 模式

`create` 与 `iterate` 均走三阶段，见 `SKILL.md`。

## 校验（用户或 CI）

```bash
deno run -A .cursor/skills/skill-builder/scripts/validate-skill-structure.ts .cursor/skills/<skill-name>
deno test -A .cursor/skills/skill-builder/tests/structure-check.test.ts
```
