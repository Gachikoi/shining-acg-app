# Spec 驱动开发

本目录是需求与开发进度的工作流真相源（目录约定）。**Agent 执行流程**以 Skill 为准，不写在根 `AGENTS.md`：

- 创建 / 迭代 Spec → `.cursor/skills/spec-tasklist-builder`
- 按 Spec 实现一个任务 → `.cursor/skills/implement-from-spec`

采用**渐进披露**，避免单文件过长撑爆上下文。组件详述采用**方案 C**：同文件 **分析**（怎么拆、方块样子用自然语言）+ **实现契约**（怎么做、事件表与验收）。

## 文件约定

```text
.specs/<area>/<slug>.spec.md                       # 主文件：目标/约束/索引/任务进度/总验收
.specs/<area>/<slug>/<area-dir>/_index.md          # 子需求编排（短；不写方块样子）
.specs/<area>/<slug>/<area-dir>/*.md               # 组件详述（扁平；分析 + 实现契约）
.specs/<area>/<slug>/<area-dir>/<module>/*.md      # 组件详述（可选二级嵌套 · 子组件）
.specs/<area>/<slug>/qa/<task_id>.md               # 人测 QA（实现后；按功能点给人点 UI）
```

- **主文件**：Agent 入口；含任务表与 `spec` 列索引；进度只改这里。
- **`_index.md`**：页面/Tab 级编排（职责、子组件链接、编排交互、复用）。
- **组件文件**：元信息 + **分析**（目标 / 模块方块+样子 / 交互意图）+ **实现契约**（状态 / 边界 / 事件表 / 验收）+ **子组件 (`children`)**。
- **方块**：只存在于分析层，不单独成文件、不进任务表。
- **二级嵌套**：`area-dir` 下最多一层 `<module>/`（子组件）；用 `children` 表达父子。
- **`qa/<task_id>.md`**：`implement-from-spec` 实现后产出；标 `done` 前必须存在。
- **不再使用**独立 `.tasks.md`（若存在仅为废弃跳转）。
- `status`：`todo`、`doing`、`done`、`blocked`、`unknown`。

## Agent 读法（强制）

1. 只读主 `.spec.md` → 选 `todo`/`unknown`（或用户指定 id）。
2. 只打开该行 `spec` 指向的组件文件。
3. **先读 `## 分析`，再读 `## 实现契约`**。
4. 需要编排时再读同目录 `_index.md`。
5. 需要子件时再按该文件 **子组件 (`children`)** 链接下钻。
6. **禁止**一次读入该 slug 下全部详述或整棵子树。

## 组件详述约定

1. **分析 · 样子**：自然语言（形状 / 层级 / 密度 / 状态 / 响应）；禁止默认写死 px 或完整 Tailwind 串。细则见 `.cursor/skills/spec-tasklist-builder/references/visual-language.md`。
2. **分析 · 交互**：短列表「意图 → 回调名」。
3. **契约 · 交互**：事件表 + 稳定回调名。
4. **契约 · 参考实现**：可选 Tailwind/组件名，必须标「参考（非强制）」。
5. 必须声明 **父节点** 与 **子组件 (`children`)**（无子件写 `无`）。
6. 两层冲突：以分析层视觉意图为准；读不清标 `待澄清`。

模板：

- `.cursor/skills/spec-tasklist-builder/templates/spec.md`
- `.cursor/skills/spec-tasklist-builder/templates/area-index.md`
- `.cursor/skills/spec-tasklist-builder/templates/component-detail.md`
- `.cursor/skills/spec-tasklist-builder/examples/good-spec-sample.md`

## 阶段一：创建或迭代 Spec

使用 `spec-tasklist-builder`：澄清 → 确认树（含是否启用 `<module>/`）→ 写主文件 + 分片。不在此阶段写业务代码。新 create 与触达的 iterate 必须用双层格式。

参考：`.specs/notification/notification-im.spec.md` 与 `.specs/notification/notification-im/`（**旧单层格式，已冻结**；见下方「旧格式」）。

## 阶段二：实现一个任务

使用 `implement-from-spec`：主文件选任务 → 只读对应详述（先分析后契约）→ 按需 `children` 下钻 → 计划待 `APPROVED` → 实现 → 人测 QA（`qa/<task_id>.md`）→ 门禁 → 回写主文件进度。

## 旧格式（冻结）

`notification`、`profile` 等既有详述可能仍是「组成 / UI·Tailwind / 交互」单层：

- **不批量改写**，除非用户显式要求 `iterate` 触达升级。
- `implement-from-spec` 可将旧「组成+UI」当作分析替代、「交互+验收」当作契约替代，并在 warnings 标明格式过期。
- 新 `create` 一律双层；`iterate` 仅升级触达文件。

## 变更边界

- 实现阶段不得改写详述中的分析层意图与契约层组件验收。
- 范围变化先 `spec-tasklist-builder` iterate。
- 不得手改 `packages/web/src/lib/api/**`。
- 不自动创建分支、提交或推送。
