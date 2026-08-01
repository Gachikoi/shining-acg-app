# skill-builder 实现说明

> v2.6.0 | 面向维护者与 Harness 集成者。Agent 日常只需读 `SKILL.md`。

---

## 1. 架构概览

skill-builder 把「创建/迭代 Skill」拆成四层，避免 AI 凭对话记忆推进流程：

| 层 | 职责 | 典型位置 |
|----|------|----------|
| **AI 指令** | 读注入状态，按 `next_action` 与用户对话、生成目标文件 | `SKILL.md` |
| **契约** | 声明 inputs/outputs、错误码、安全边界 | `schema.json`、`metadata.yaml` |
| **运行时元数据** | 持久化阶段进度、需求字段、`next_action` | `.meta/*.json` |
| **系统编排** | 调脚本、注入状态、跑 hook 与校验 | `.harness/`、`hooks/`、`scripts/` |

核心原则：**AI 是状态机执行者，不是状态维护者**。循环与退出条件由 Python 脚本计算，状态写入 `.meta/`。

```
用户 → Harness → [pre hook] → session reset → status 脚本 → 注入 {{CLARIFY_STATE}}
              → Agent（SKILL.md）→ 用户对话
              → parse/confirm 脚本 → 更新 .meta/
              → … design / build 同理 …
              → [post hook] → validate 脚本
```

---

## 2. 目录结构总览

```
.cursor/skills/skill-builder/
├── SKILL.md                 # AI 说明书（Agent 激活时读取）
├── schema.json              # 调用契约（inputs/outputs/security）
├── metadata.yaml            # 注册表补充信息（模式、依赖、loop_engine）
│
├── .meta/                   # 运行时元数据（脚本读写）
├── .harness/                # Harness 流程定义（Agent 不读）
├── hooks/                   # pre/post 钩子说明（Harness 专用）
├── scripts/                 # Loop 脚本 + 结构校验
├── templates/               # 生成目标 Skill 时的骨架
├── examples/                # 正反例样本
├── references/              # 维护者参考规范（Agent 按需）
├── tests/                   # 自动化测试与 E2E 场景
└── docs/                    # 人类文档（本文件、DESIGN.md 等）
```

---

## 3. 按类型分类的文件说明

### 3.1 AI 指令层

| 文件 | 含义 |
|------|------|
| `SKILL.md` | 唯一面向 Agent 的主文档。描述设计原则、三阶段职责、`next_action` 执行表、交互示例。不含 `parameters`、不含「Agent 必须跑某脚本」类系统指令。 |

**Agent 何时读**：Skill 被激活时自动加载；阶段内读 Harness 注入的 `{{CLARIFY_STATE}}` / `{{DESIGN_STATE}}` / `{{BUILD_STATE}}`（内容来自 `.meta/`，非直接读文件）。

---

### 3.2 契约与注册元数据

| 文件 | 含义 |
|------|------|
| `schema.json` | **调用契约**。`inputs`：`mode`、`skill_name`、`target_skill_path`（Harness 可预填）；`outputs`：各阶段状态结构、`clarify_record` 扁平视图；`preconditions` / `post_validations` / `security` / `error_codes`。 |
| `metadata.yaml` | **注册与能力声明**。`modes`、`phases`、`loop_engine.scripts` 列表。|

**谁读**：Harness 解析参数与后置校验；维护者改版本时同步更新。

---

### 3.3 静态与运行时元数据（`.meta/`）

| 文件 | 类型 | 含义 |
|------|------|------|
| `requirements_schema.json` | **静态** | create/iterate 各自的需求项定义：`id`、`label`、`required`、`validate`（如 kebab_case）、`default`。 |
| `clarify_state.json` | **运行时** | clarify 阶段状态：`mode`、`requirements[]`（含 `value`/`state`）、`clarify_record`、`next_action`、`can_exit`。 |
| `design_state.json` | **运行时** | design 阶段：`design_record`（`design_doc`、`target_dir`、`file_plan`、`schema_draft`）、`next_action`。 |
| `build_state.json` | **运行时** | build 阶段：`build_record`（`files_planned`、`files_done`、`files_skipped`）、`next_action`。 |
| `README.md` | 文档 | 说明 Harness 每轮如何调 `clarify_loop.py` 维护上述 JSON。 |

**维护方式**：

- 静态 schema：人工编辑 `requirements_schema.json`
- 运行时：仅通过 `scripts/clarify_loop.py` 子命令写入，Agent 不直接改文件

---

### 3.4 Harness 编排（`.harness/`）

| 文件 | 含义 |
|------|------|
| `flow.yaml` | **流程真相源**。声明 `modes` 流水线（clarify→design→build）、`loop_engine` 各阶段脚本命令模板、注入占位符（`{{CLARIFY_STATE}}` 等）、`validations.after_build`、`contract` 指针。 |
| `README.md` | Harness 集成说明与执行顺序摘要。 |

**谁读**：Harness / CI；Agent **不读**。

---

### 3.5 Hooks（`hooks/`）

| 文件 | 含义 |
|------|------|
| `pre-execution.md` | **进入前**：解析/推断 `mode`、校验 `target_skill_path`、`session reset` + `status` 注入、记录 `started_at`。含每轮用户回复后的 R1–R4 步骤表。 |
| `post-execution.md` | **结束后**：汇总 `status`/`artifacts`/`metrics`、按 `output-summary-template` 展示。 |

**性质**：伪代码级步骤清单，供 Harness 实现参考；不是 Agent 指令。

---

### 3.6 Loop 与状态脚本（`scripts/`）

| 文件 | 含义 |
|------|------|
| `state_manager.py` | 读写 `.meta/*.json`；`init_clarify_state` / `init_design_state` / `init_build_state`；`sync_clarify_record` 把 `requirements[]` 扁平化为 `clarify_record`。 |
| `loop_guard.py` | 计算 `next_action`、`can_exit`、`loop_context`。三阶段各自 `compute_*_next_action`。 |
| `requirement_parser.py` | 解析用户回答：确认词、可选字段 waive、kebab-case 校验；`parse`（对话）与 `apply`（显式赋值）两种严格度。 |
| `clarify_loop.py` | **CLI 入口**。子命令 `clarify` / `design` / `build`，各含 `init`、`status`、`parse`、`apply`、`confirm`、`next` 等。Harness 按 `flow.yaml` 调用。 |
| `validate-skill-structure.ts` | **产出物结构校验**（Deno）。检查目标 Skill 目录的 SKILL.md yaml、schema.json、触发词数量等。build 后由 Harness/CI 执行。 |
| `skill-self-check.md` | **产出物内容自检清单**（18 条）。Agent 面质量要求的人工/半自动 checklist。 |

---

### 3.7 模板（`templates/`）

| 文件 | 含义 |
|------|------|
| `skill-md-template.md` | 目标 `SKILL.md` 骨架（分阶段步骤表占位）。 |
| `design-doc-template.md` | design 阶段设计文档结构。 |
| `schema-template.json` | 目标 `schema.json` 骨架。 |
| `clarify-record-template.json` | `clarify_record` 空字段模板（文档/工具用）。 |
| `output-summary-template.md` | post-execution 输出摘要格式。 |
| `status_table.tpl` | Harness 将 `clarify_state` 渲染为 Markdown 表的模板。 |

**Agent 何时读**：build 阶段按需读取对应模板生成目标 Skill 文件。

---

### 3.8 正反例（`examples/`）

| 文件 | 含义 |
|------|------|
| `good-skill-sample.md` | 符合工程化标准的 Skill 节选（质量上界）。design/build 阶段风格参考。 |
| `bad-skill-sample.md` | 典型反例：链式索引、参数堆在 yaml、系统指令混入正文等。 |

---

### 3.9 参考文档（`references/`）

| 文件 | 含义 |
|------|------|
| `skill-engineering-spec.md` | 目标 Skill 工程化规范（yaml 格式、description 写法、目录约定）。维护者文档。 |
| `skill-000-mapping.md` | 与「000 好 Skill 标准」的条款映射。 |
| `skill-examples-index.md` | 仓库内其他 Skill 参考索引。 |
| `backfill-workflow.md` | 坏案例回填流程说明。 |
| `flows/clarify.md` | 旧版 clarify 流程细节（**已内联至 SKILL.md**，仅供维护 skill-builder 本身时查阅）。 |
| `flows/design.md` | 同上，design 阶段。 |
| `flows/build.md` | 同上，build 阶段。 |
| `flows/README.md` | 标明 flows 目录为维护者参考，Agent 无需加载。 |

---

### 3.10 测试（`tests/`）

| 文件/目录 | 含义 |
|-----------|------|
| `clarify-loop.test.ts` | Deno 测试：调 Python 跑 create 全流程至 `exit_to_design`；kebab-case 非法值拒绝。 |
| `structure-check.test.ts` | 调 `validate-skill-structure.ts` 测 fixture 与 skill-builder 自身。 |
| `e2e-scenarios.md` | 人工/E2E 验收场景描述（create、iterate、校验失败等）。 |
| `fixtures/minimal-valid-skill/` | 最小合法 Skill 目录样本。 |
| `fixtures/invalid-missing-schema/` | 缺 schema 的非法样本。 |

---

### 3.11 设计文档（`docs/`）

| 文件 | 含义 |
|------|------|
| `IMPLEMENTATION.md` | 本文件：实现全貌。 |
| `DESIGN.md` | 设计决策摘要（v2.5 四层分工、Loop Engineering）。 |
| `README.md` | 简短使用说明与校验命令。 |

---

## 4. 完整流程与每步读取的文件

### 4.0 触发与模式判定

| 步骤 | 执行者 | 操作 | 读取的文件 |
|------|--------|------|------------|
| 0.1 | Harness | 用户消息命中 `SKILL.md` description 触发词 | `SKILL.md`（yaml description） |
| 0.2 | Harness | 解析可选参数 | `schema.json#inputs` |
| 0.3 | Harness | pre-execution | `hooks/pre-execution.md`、`.harness/flow.yaml` |

---

### 4.1 阶段一：clarify

| 步骤 | 执行者 | 操作 | 读取/写入的文件 |
|------|--------|------|-----------------|
| 1.1 | Harness | `session reset --mode <create\|iterate>` | 写 `clarify_state.json`（重置）、`design_state.json`、`build_state.json`（空闲壳）；读 `requirements_schema.json` |
| 1.2 | 脚本 | `loop_guard.compute_clarify_next_action` | 读/写 `clarify_state.json` |
| 1.3 | Harness | `clarify status` → 注入 `{{CLARIFY_STATE}}` | 读 `clarify_state.json` |
| 1.4 | Agent | 按 `next_action` 提问或展示摘要 | 读注入状态（源自 `SKILL.md` 内阶段说明） |
| 1.5 | Harness | 用户回复后 `clarify parse --text "..."` | 读/写 `clarify_state.json`；逻辑在 `requirement_parser.py` |
| 1.6 | 脚本 | 同步扁平记录 | 写 `clarify_state.json#clarify_record`（`state_manager.sync_clarify_record`） |
| 1.7 | Harness | 重复 1.2–1.6 直到 `next_action.type === wait_for_confirmation` | 同上 |
| 1.8 | Agent | 展示 `clarify_record` 摘要，请用户确认 | 注入状态中的 `clarify_record` |
| 1.9 | Harness | `clarify confirm` | 写 `clarify_state.json`（`user_confirmed=true`） |
| 1.10 | 脚本 | `can_exit=true`，`next_action=exit_to_design` | 写 `clarify_state.json` |
| 1.11 | Harness | 可选渲染状态表 | `templates/status_table.tpl` + `clarify_state.json` |

**create 模式收集字段**（定义于 `requirements_schema.json`，值存于 `clarify_state.json`）：

`skill_name` → `core_problem` → `trigger_scenario` → `capabilities` → `expected_output` → `references`（可选）

**iterate 模式**：`target_skill_path` → `existing_summary` → `change_intent` → `change_scope` → `references`（可选）

Agent 读已有 Skill 时：读用户提供的 `target_skill_path` 指向的 **目标** `SKILL.md`（非 skill-builder 自身文件）。

---

### 4.2 阶段二：design

| 步骤 | 执行者 | 操作 | 读取/写入的文件 |
|------|--------|------|-----------------|
| 2.1 | Harness | `design init --from-clarify` | 读 `clarify_state.json`；写 `design_state.json` |
| 2.2 | Harness | `design status` → 注入 `{{DESIGN_STATE}}` | 读 `design_state.json` |
| 2.3 | Agent | 起草设计文档 | 按需读 `templates/design-doc-template.md`、`references/skill-engineering-spec.md`、`examples/good-skill-sample.md` |
| 2.4 | Harness | `design update-doc --doc "..."` [--target-dir] [--file-plan] | 写 `design_state.json` |
| 2.5 | Agent | 展示设计，请用户确认 | 注入 `design_state.json#design_record` |
| 2.6 | Harness | `design confirm` | 写 `design_state.json`；`next_action=exit_to_build` |
| 2.7 | Harness | `design init` 时 `target_dir` 来自 clarify | create：`.cursor/skills/<skill_name>`（`skill_name` 来自 `clarify_record`） |

---

### 4.3 阶段三：build

| 步骤 | 执行者 | 操作 | 读取/写入的文件 |
|------|--------|------|-----------------|
| 3.1 | Harness | `build init --from-design` | 读 `design_state.json`；写 `build_state.json`（`files_planned` 来自 `file_plan`） |
| 3.2 | Harness | `build status` → 注入 `{{BUILD_STATE}}` | 读 `build_state.json` |
| 3.3 | Agent | `next_action=generate_file`：生成单个文件 | 按需读 `templates/skill-md-template.md`、`templates/schema-template.json` 等 |
| 3.4 | Agent | iterate：修改前展示 diff | 读目标 Skill 目录下已有文件 |
| 3.5 | Harness | `build mark-done --file-path <path>` | 写 `build_state.json#files_done` |
| 3.6 | 重复 3.2–3.5 直至无剩余 `files_planned` | | |
| 3.7 | Agent | `build_complete`：展示摘要 | 注入 `build_record` |
| 3.8 | Harness | `build confirm` | 写 `build_state.json`；`can_exit=true` |

**写入位置**：`design_state.json#design_record.target_dir` 下的目标 Skill 目录（非 skill-builder 目录）。

---

### 4.4 后置：校验与收尾

| 步骤 | 执行者 | 操作 | 读取的文件 |
|------|--------|------|------------|
| 4.1 | Harness | post-execution | `hooks/post-execution.md`、`templates/output-summary-template.md` |
| 4.2 | Harness/CI | 内容自检 | `scripts/skill-self-check.md`（对照**目标** Skill 的 `SKILL.md`） |
| 4.3 | Harness/CI | 结构校验 | `scripts/validate-skill-structure.ts` + **目标** Skill 目录 |
| 4.4 | 维护者/CI | 回归测试 | `tests/clarify-loop.test.ts`、`tests/structure-check.test.ts` |

校验命令示例：

```bash
deno run -A .cursor/skills/skill-builder/scripts/validate-skill-structure.ts .cursor/skills/<skill-name>
deno test -A .cursor/skills/skill-builder/tests/
```

---

## 5. 脚本调用速查（Harness 集成）

与 `.harness/flow.yaml#loop_engine` 对应：

```bash
# 每次激活首轮（推荐）
python scripts/clarify_loop.py session reset --mode create

# clarify（reset 已含 init；单独 init 等价于 reset）
python scripts/clarify_loop.py clarify status
python scripts/clarify_loop.py clarify parse --text "<用户原文>"
python scripts/clarify_loop.py clarify apply --id skill_name --value pr-description-builder
python scripts/clarify_loop.py clarify confirm

# design
python scripts/clarify_loop.py design init --from-clarify
python scripts/clarify_loop.py design update-doc --doc "..." --target-dir ".cursor/skills/foo" --file-plan "SKILL.md,schema.json"
python scripts/clarify_loop.py design confirm

# build
python scripts/clarify_loop.py build init --from-design
python scripts/clarify_loop.py build mark-done --file-path SKILL.md
python scripts/clarify_loop.py build confirm
```

---

## 6. 数据流简图

```
requirements_schema.json（静态）
        │
        ▼ init
clarify_state.json ──sync──► clarify_record（扁平视图）
        │ confirm + can_exit
        ▼
design_state.json ──► design_record（design_doc, file_plan, target_dir）
        │ confirm + can_exit
        ▼
build_state.json ──► build_record（files_planned → files_done）
        │
        ▼
目标 .cursor/skills/<name>/   ──validate──► validate-skill-structure.ts
```

---

## 7. 与仓库其他模块的关系

| 模块 | 关系 |
|------|------|
| `tech-plan-builder` | 同仓库 Skill；技术方案场景可对照其结构 |
| 目标 Skill 的 `.harness/` | 由 skill-builder **生成**到目标目录，结构可参考 skill-builder 自身 |

---

## 8. 运行时元数据 Reset

每次 skill-builder **激活**时，Harness 必须执行：

```bash
python scripts/clarify_loop.py session reset --mode <create|iterate>
```

| 动作 | 文件 |
|------|------|
| 清空 design/build 进度 | `design_state.json`、`build_state.json` → 空闲壳 |
| 重启 clarify | `clarify_state.json` → 新 `requirements[]`、`user_confirmed=false` |
| 重算首问 | `next_action=ask_question`（首项 pending） |

`clarify init` 内部同样调用 `reset_runtime_states`，与 `session reset` 行为一致。

未跑 reset 时，磁盘上次的 `can_exit=true` 或 `files_done` **可能污染新会话**。

---

## 9. 当前集成状态说明

- **脚本与测试**：`clarify_loop.py` 与 `deno test` 可独立验证 Loop 逻辑。
- **Harness 注入**：`{{CLARIFY_STATE}}` 等占位符在 `flow.yaml` 中已声明；Cursor 会话内是否自动注入取决于 Harness 实现是否接线。
- **Agent 约束**：即使未接线，Agent 仍应遵守 `SKILL.md`——不自行维护 `.meta/` 状态，不跳过 `can_exit` 门禁。

---

*维护者：修改流程时同步更新 `SKILL.md`、`.harness/flow.yaml`、`schema.json` 与本文件。*
