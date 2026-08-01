---
name: implement-from-spec
description: |
  根据 .specs 下渐进披露的 Spec 主文件实现恰好一个任务节点。
  触发：用户要按 Spec 开发、实现指定 task id、实现任务清单下一项；或说「按 spec 开发」「实现下一个任务」「实现任务 id」「implement from spec」「做 tasks 里的一项」。
  不触发：创建/迭代 Spec、只读评审、同时实现多项、没有 Spec 的临时需求。
version: "2.8.0"
---

# implement-from-spec

你是按 Spec 实现的执行助手：每次只落地**一个**任务节点。接收可选的 Spec 路径与 `task_id`；基于主文件任务表与分片详述实现并回写进度；输出代码改动、人测 QA 与门禁结果（见 `schema.json#outputs`）。

> **边界**：本 Skill 是 Spec→实现工作流的权威说明（选任务、渐进披露、APPROVED、QA、状态回写）。根 `AGENTS.md` 只保留全仓通用约定（Web 栈、禁改 `$lib/api`、门禁命令等），**不再**重复本流程；未激活本 Skill 时不要按 Spec 实现规则强行执行。

## 原则

1. 每次只处理一个 `task_id`。用户可指定；未指定时按主文件任务表顺序选首个 `todo` 或 `unknown`。
2. **渐进披露读法**：先主 Spec → 再该行 `spec` 详述（**先「分析」后「实现契约」**）→ 需要编排再读同 area `_index` → `children` 仅接线时按需打开；禁止整包加载分片（细则见 `references/progressive-read.md`）。路径约定见 `.specs/README.md`。
3. 主文件目标/约束/总验收与详述**分析层意图**、**契约层组件验收**只读；范围变化交回 `spec-tasklist-builder`。两层冲突以**分析层视觉意图**为准；Spec/设计/代码契约冲突时停止业务写入，每轮只澄清一个问题。
4. **视觉**按分析层自然语言方块映射到项目 Tailwind / shadcn / zinc·red；**行为**按契约层事件表 + 回调名。禁止跳过分析只抄契约里的参考 class；参考 class 非强制。旧单层详述可回退实现，须 warning 标明格式过期。
5. 任务行 `design` 为设计入口；缺失或冲突时停止业务写入。
6. 写代码前展示文件级计划与验证命令，等待用户明确回复 `APPROVED`（用户声明默认批准除外）。
7. 遵守根 `AGENTS.md` 的全仓约束（不手改 `packages/web/src/lib/api/**`、不恢复 `packages/web/AGENTS.md`、不自动分支/提交/推送、不覆盖无关改动）。
8. `done` = 组件验收 + **QA 已落盘**（`.specs/.../qa/<task_id>.md`）+ 包级门禁通过；外部依赖缺失用 `blocked` 并在 `notes` 写明；验证失败仍可修时保持 `doing`。
9. 进度只回写主文件任务行（真实 `files`；`notes` 可含 `qa:`）；临时 mock 必须含 `TEMP MOCK`（见 `references/qa-and-mock.md`）；禁止把 mock 写入 Skill 目录。
10. 实现过程不得改写详述的分析层意图或契约层组件验收。

## 流程

### 步骤一：选任务

做什么：定位主 Spec；按 `references/task-selection.md` 选出唯一 `task_id`（用户指定或首个 `todo`/`unknown`）。
输出：主文件路径与唯一 `task_id`。
校验：主 Spec 与 task 唯一；歧义则每轮只问一个定位问题，不得猜测继续。

### 步骤二：读依据

做什么：读该行 `spec` 详述（先分析后契约；可选同 area `_index`；按需 `children`）、`design`、相关代码；需要时扫一眼根 `AGENTS.md` 的 Web/门禁约定；遵守渐进披露与旧格式回退（见 `progressive-read.md`）。
输出：方块意图 / 样子 / 交互可读，足以写计划。
校验：新格式缺「分析」则停止写入并澄清；未整包读子树；Spec/设计/代码契约冲突则澄清。

### 步骤三：展示计划

做什么：按 `references/plan-format.md` 展示文件级计划（对照方块意图与回调、将写的 QA 路径）、非目标、验证命令；等待 `APPROVED`。
输出：用户已批准（或显式默认批准）。
校验：计划含任务 id、依据路径、改动文件、QA 路径、验证命令；未批准不进入实现。

### 步骤四：实现任务

做什么：主文件将该任务设为 `doing`；只实现本任务；临时 mock 加 `TEMP MOCK` 注释。
输出：本任务代码完成。
校验：未顺带第二任务；未改详述分析意图/契约验收；未手改 api 生成物。

### 步骤五：落盘人测 QA

做什么：按 `references/qa-and-mock.md` 与 `templates/qa-task.md` 写入 `.specs/<area>/<slug>/qa/<task_id>.md`。
输出：QA 文件已落盘（功能点简介 / 如何测试 / 怎样算通过）。
校验：三要素齐全；文档头含 `task_id`、关联 spec、mock 依赖说明。

### 步骤六：跑门禁

做什么：先跑与改动直接相关的检查，再跑受影响包完整门禁（Web：`format:check:path` / `lint:path` / `check` / `lint`）。
输出：门禁全部满足，或记入失败原因。
校验：可修则改到通过；失败且不可继续则不得标 `done`。

### 步骤七：回写进度并摘要

做什么：按 `references/status-rules.md` 回写 `status` / `files` / `notes`（含 `qa:` 路径）与进度摘要；对照 `scripts/skill-self-check.md`；按 `schema.json#outputs` 返回。
输出：主文件状态一致；完成摘要含 artifacts（须含 QA）、gates、task_update、warnings（旧格式回退须 warning）。
校验：无 QA 不得 `done`；外部依赖缺失用 `blocked`；自检清单无未勾关键项。

## 参考资料（按需读取）

- 渐进披露读法 → [`references/progressive-read.md`](references/progressive-read.md)
- 选任务规则 → [`references/task-selection.md`](references/task-selection.md)
- 计划格式 → [`references/plan-format.md`](references/plan-format.md)
- 人测 QA 与 TEMP MOCK → [`references/qa-and-mock.md`](references/qa-and-mock.md)
- 状态规则 → [`references/status-rules.md`](references/status-rules.md)
- QA 模板 → [`templates/qa-task.md`](templates/qa-task.md)
- 结束自检 → [`scripts/skill-self-check.md`](scripts/skill-self-check.md)
- 契约 → [`schema.json`](schema.json)

## 注意事项

- 范围变化或要新建/迭代 Spec → 交回 `spec-tasklist-builder`，本 Skill 不改详述需求正文。
- 用户只要概念说明、不实现时，友好回答即可，不进入流程。
