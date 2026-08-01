# 需求Spec 主文件：{{TITLE}}功能/页面开发

> **渐进披露入口**。Agent 只先读本文件；实现某 task 时再打开该行 `spec` 指向的组件详述（需要编排时再读同 area 的 `_index.md`）。**禁止**一次读入全部详述。  
> 组件详述为方案 C 双层：先「分析」（方块 + 自然语言样子），再「实现契约」（状态 / 事件表 / 验收）。

## 目标描述

{{ONE_LINER_USER_AND_SCENE}}

## 技术约束

- 技术栈：{{STACK}}（默认对齐根 `AGENTS.md`）
- 状态管理：{{STATE}}
- 编码规范：触控 ≥ 44×44；输入必有 maxlength；禁手改 `packages/web/src/lib/api/**`
- UI 规格：组件详述 **分析层**用自然语言方块描述样子；实现时映射项目 Tailwind / shadcn / zinc·red 约定；契约中 class 仅为「参考（非强制）」；读不清标「待澄清」
- 交互规格：分析层用 **意图 → 回调名**；实现契约用 **事件表 + 回调名**
- 设计真相源：`{{DESIGN_ROOT}}`
- 详述分片目录：`.specs/{{AREA}}/{{SLUG}}/`
- 进度真相源：本文件「任务与进度」（不使用独立 `.tasks.md`）

## 功能需求索引

> 维度一：子需求（页面/Tab）→ `{{SLUG}}/<area>/_index.md`  
> 维度二：子功能/组件 → `{{SLUG}}/<area>/<component>.md`（内含分析 + 实现契约）

- [{{AREA_1_TITLE}}]({{SLUG}}/{{AREA_1_DIR}}/_index.md) — `{{AREA_1_ID}}`
- [{{AREA_2_TITLE}}]({{SLUG}}/{{AREA_2_DIR}}/_index.md) — `{{AREA_2_ID}}`

## 任务与进度

> `status`: `todo` | `doing` | `done` | `blocked` | `unknown`

### 进度摘要

| 指标 | 值 |
|------|-----|
| 总计 | {{TOTAL}} |
| done | {{DONE}} |
| doing | {{DOING}} |
| todo | {{TODO}} |
| blocked | {{BLOCKED}} |
| unknown | {{UNKNOWN}} |

## {{AREA_1_TITLE}}

- **area_spec**: [`{{SLUG}}/{{AREA_1_DIR}}/_index.md`]({{SLUG}}/{{AREA_1_DIR}}/_index.md)

### 任务

| id | title | status | design | spec | files | notes |
|----|-------|--------|--------|------|-------|-------|
| `{{COMP_1_ID}}` | {{COMP_1_TITLE}} | todo | `{{COMP_1_DESIGN}}` | [`{{COMP_1_FILE}}`]({{SLUG}}/{{AREA_1_DIR}}/{{COMP_1_FILE}}) | [] | |
| `{{COMP_2_ID}}` | {{COMP_2_TITLE}} | todo | `{{COMP_2_DESIGN}}` | [`{{COMP_2_FILE}}`]({{SLUG}}/{{AREA_1_DIR}}/{{COMP_2_FILE}}) | [] | |

### 更新约定

1. 实现后更新本文件对应行的 `status` / `files` / `notes`。
2. 实现以该行 `spec` 文件为准：先读「分析」，再读「实现契约」；编排读同 area `_index.md`。
3. 不得一次加载全部组件详述。
4. 范围变更用 `spec-tasklist-builder` iterate；触达的详述须升到双层格式。

## 验收标准

- [ ] {{AC_1_QUANTITATIVE}}
- [ ] 每个可开发组件均有独立详述文件，且含 **分析**（目标 / 方块+样子 / 交互意图）与 **实现契约**（状态 / 边界 / 事件表 / 组件验收）
- [ ] 主文件任务表与 `{{SLUG}}/**` 详述 id 一一对应
