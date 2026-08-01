# Spec 格式版本

| 版本 | 形态 | 适用范围 |
|------|------|----------|
| **C（当前默认）** | 组件详述同文件双层：`## 分析` + `## 实现契约` | 新 `create`；`iterate` 触达的文件 |
| **legacy（冻结）** | 组成 / UI·Tailwind / 交互单层 | 既有 `notification/notification-im`、`profile/mine-profile` 等，直至显式 iterate 升级 |

- 方块（视觉模块）只写在分析层，不单独成文件、不进任务表。
- 样子用自然语言；契约中 class 仅为「参考（非强制）」。
- 权威模板与公约：`.cursor/skills/spec-tasklist-builder/`（含 `references/visual-language.md`）。
