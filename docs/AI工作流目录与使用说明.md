# AI 工作流目录与使用说明

仓库 AI 开发两阶段：先 Spec，再按任务实现。

| 文档 / Skill | 职责 |
|--------------|------|
| [`AGENTS.md`](../AGENTS.md) | Agent 开机页：技术栈与架构目录地图；只路由到 Skill，不展开 Spec 流程 |
| [`.cursor/skills/spec-tasklist-builder`](../.cursor/skills/spec-tasklist-builder/SKILL.md) | 阶段一权威：生成 / 迭代 Spec |
| [`.cursor/skills/implement-from-spec`](../.cursor/skills/implement-from-spec/SKILL.md) | 阶段二权威：每次实现一个任务 |
| [`.specs/README.md`](../.specs/README.md) | Spec 目录与读法约定 |

## 主链路

```text
设计入库 (.design/)
    → 创建/迭代 Spec (spec-tasklist-builder)
    → 主 Spec 选一个任务 + 只读该行分片（先分析后实现契约）
    → 实现 (implement-from-spec)
    → 人测 QA + 门禁
    → 回写主 Spec 进度
    → 下一任务 或 开 PR
```

范围变了 → `spec-tasklist-builder` 的 `iterate`，不要硬改实现中的详述。  
只同步进度 → `sync-progress`。

## 目录

```text
shining-acg-app/
├─ AGENTS.md                         # Agent 项目地图（栈 + 架构目录）
├─ .github/PULL_REQUEST_TEMPLATE.md  # PR 绑定 Spec / task / 门禁
├─ .cursor/                          # Skills / Rules（随仓库）
│  ├─ rules/10-web-svelte.mdc
│  └─ skills/
│     ├─ spec-tasklist-builder/      # 阶段一权威（方案 C 双层详述）
│     ├─ implement-from-spec/        # 阶段二权威
│     └─ skill-builder/              # 造 Skill，不在业务主链
├─ .design/<area>/...                # 设计真相源（随仓库）
├─ .specs/<area>/
│  ├─ <slug>.spec.md                 # 主文件：目标/约束/索引/任务进度/总验收
│  └─ <slug>/
│     ├─ qa/<task_id>.md             # 人测 QA（实现后；标 done 前必须有）
│     └─ <area-dir>/
│        ├─ _index.md                # 子需求编排（短；不写方块样子）
│        ├─ <component>.md           # 组件详述（分析 + 实现契约）
│        └─ <module>/                # 可选二级嵌套（子组件）
│           └─ <component>.md
└─ docs/                             # 其他文档（非 Spec/设计真相源）
```

`.design/`、`.specs/`、`.cursor/` 随仓库分发；`AGENTS.md` 与 `docs/` 为人读入口。

## 渐进披露读 Spec

```text
主文件 .spec.md          ← 先读：选任务、看进度
  ├─ 任务行 design → .design/...（按需）
  └─ 任务行 spec   → 当前组件详述（必读）
                       ├─ ## 分析（方块 + 自然语言样子 + 交互意图）
                       ├─ ## 实现契约（状态 / 事件表 / 验收）
                       ├─ 需要编排 → 同 area _index.md（可选）
                       └─ 需要子件 → 详述中 children 链接（按需下钻）
```

**禁止**一次加载该 slug 下全部详述或整棵 `children` 子树。

任务表字段：`status` / `design` / `spec` / `files` / `notes`。  
`status`：`todo` | `doing` | `done` | `blocked` | `unknown`。  
进度只改主文件任务行；独立 `*.tasks.md` 已废弃。

## 阶段一：Spec（`spec-tasklist-builder`）

对 Agent 说：「根据 `.design/<area>` 生成 Spec」或「迭代 Spec，加入…」。

| 模式 | 作用 |
|------|------|
| `create` | 新建主 Spec + 分片（必须方案 C 双层） |
| `iterate` | 范围/设计变更，差量更新（触达文件升双层） |
| `sync-progress` | 只对照代码更新任务表，不改需求正文 |

流程：盘点设计与代码 → 每轮只澄清一个问题 → 确认组件树与落盘路径 → 写出主文件 + `_index` + 组件详述。本阶段不写业务代码。  
**分析层**：方块 + 自然语言样子 + 意图→回调；**契约层**：事件表 + 回调名 + 验收。澄清视觉时问意图，不逼问 class。

## 阶段二：实现（`implement-from-spec`）

对 Agent 说：「实现下一个任务」或「实现 `<task_id>`」。未指定则取首个 `todo`/`unknown`。

1. **Orient**：主文件任务行 + 该行 `spec`（先分析后契约）+（可选）`_index` + `design` + 相关代码；全仓约定见 `AGENTS.md`。冲突则停写并逐项问。
2. **计划**：展示改动文件、方块/回调对照、QA 路径、验证命令、非目标；等用户回复 `APPROVED`（或已声明默认批准）。
3. **实现**：主文件标 `doing`；只做一个 task；视觉按分析映射项目约定；临时 mock 加 `TEMP MOCK`；不自动 Git。
4. **人测 QA**：写入 `.specs/.../qa/<task_id>.md`（简介 / 如何测 / 怎样算通过）。
5. **门禁**（见下）通过后标 `done` 并填真实 `files`；外部缺依赖 → `blocked`；可继续修 → 保持 `doing`。

实现阶段不得改写详述里的分析层意图与契约层组件验收。

## 旧格式（冻结）

`notification` / `profile` 等既有单层详述（组成 / UI·Tailwind / 交互）**不批量迁移**。实现时可回退解读并 warning；升级须用户显式 `iterate`。

## 验证（标 `done` 前）

在 `packages/web`：

```bash
deno task format:check:path <paths...>
deno task lint:path <paths...>
deno task check
deno task lint
```

另须：人测 QA 已落盘。  
协议变更：根目录 `deno task gen:api`；**禁止**手改 `packages/web/src/lib/api/**`。

## 例外

| 情况 | 做法 |
|------|------|
| 需求/设计变了 | `iterate` Spec → 再实现 |
| 只同步进度 | `sync-progress` |
| UI 缺 design | 停写 → 补路径或标 `blocked` |
| 要改生成 API | 改协议源 → `deno task gen:api`；超范围则拆 Spec |
| 开 PR | 填 PR 模板：主 Spec、分片、`task_id`、门禁、进度已更新证据 |

## 硬约束速查

- 一次只实现一个 `task_id`；写代码前计划需 `APPROVED`。
- 不自动建分支 / commit / push；不覆盖无关改动。
- Web：Svelte 5 runes、Tailwind、zinc + `red-500`、暗色、触控 ≥ 44×44、输入有 `maxlength`。
- Spec 样子用自然语言；实现映射项目约定，不把参考 class 当唯一真相。
- 完成判断：组件验收 + 人测 QA + 包级门禁；无独立 Evaluator 强制拦截。
