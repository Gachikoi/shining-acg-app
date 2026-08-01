# Skill 最佳实践（权威）

> **适用范围**：`skill-builder` 自身，以及其 **create / iterate 产出的一切 Skill**，均须遵守本文原则与分层实现。  
> **读法**：每条均为 **是什么 → 如何实现 → skill-builder 怎么做（说明 + 代码）**。生成目标 Skill 时，以 skill-builder 为参照实现，按复杂度裁剪，不得违背原则。  
> **细则补充**：触发词句式、产物校验命令等见同目录 `skill-engineering-spec.md`。

---

## 0. 适用级别（生成时必选）

| 级别 | 何时用 | 必有 | 可选（复杂多轮再加） |
|------|--------|------|---------------------|
| **L1 最小** | 单次任务、少轮确认 | `SKILL.md` + `schema.json` + 自检清单 | hooks、examples |
| **L2 标准** | 分阶段流程 | L1 + `templates/` + `examples/` + `hooks/` | references |
| **L3 元数据驱动** | 多轮澄清、强退出门禁 | L2 + `.meta/` + Loop/状态脚本 + Harness flow | e2e 测试 |

skill-builder 自身是 **L3 完整参照**。生成简单 Skill 不要硬套全套 Python Loop，但 **1.x 原则与 2.x 分层职责不可违反**。

---

## 1. 核心思想

### 1.1 单一职责

**是什么**  
一个 Skill 只解决一类明确问题，写清何时激活、何时不该抢答。

**如何实现**  
在 `description` 里同时写「做什么 / 什么话激活 / 什么情况不激活」；能力拆 Skill，不捏万能助手。

**skill-builder 怎么做**  
只做「创建或迭代 Skill 文件」。激活看「要不要产出文件」；纯概念闲聊划为「不触发」。边界写在 yaml 头：

```1:7:.cursor/skills/skill-builder/SKILL.md
---
name: skill-builder
description: |
  创建或迭代 Skill 的元工具。
  触发：用户要产出 Skill 文件（「新建 skill」「写 skill」…）。
  不触发：仅口头咨询概念、不涉及产出文件的一般编程任务。
version: "2.6.0"
```

**生成目标 Skill 时**：同样压缩 `description`；正文再展开流程。禁止在 description 里写步骤说明书。

---

### 1.2 契约优先

**是什么**  
先钉死输入输出与安全边界，再谈怎么说话、怎么生成文件。

**如何实现**  
独立契约文件声明 `inputs` / `outputs` / `security`；参数不塞进 `SKILL.md` 的 yaml。

**skill-builder 怎么做**  
调用面集中在 `schema.json`：模式枚举、kebab-case 正则。对话不代替契约：

```7:25:.cursor/skills/skill-builder/schema.json
  "inputs": {
    "type": "object",
    "properties": {
      "skill_name": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]*$",
        "description": "要创建的 Skill 名称（kebab-case）"
      },
      "mode": {
        "type": "string",
        "enum": ["create", "iterate"],
        "default": "create"
      },
      "target_skill_path": {
        "type": "string",
        "description": "iterate 模式下目标 SKILL.md 路径"
      }
    }
  },
```

**生成目标 Skill 时**：必须产出 `schema.json`；yaml 仅 `name` / `description` / `version`。

---

### 1.3 渐进披露

**是什么**  
默认只给最少必要上下文；细节规范、模板、样例到了阶段再打开。

**如何实现**  
主文件写清「当前怎么做」；文末「按需读取」指向子目录；禁止强制链式预读大表。

**skill-builder 怎么做**  
热路径只交代：读注入状态、执行 `next_action`。调度与脚本不算进模型硬记义务：

```14:23:.cursor/skills/skill-builder/SKILL.md
本 Skill 的流程由 **元数据（`.meta/`）** 驱动，由 **脚本（`scripts/`）** 控制循环。你的职责是：
1. 每轮对话开始时，读取系统注入的 `{{CLARIFY_STATE}}` …
2. 根据状态中的 `next_action` 执行对应操作
3. 将用户回复交给 Harness…
4. 不自己维护状态，不自己判断「是否该进入下一阶段」

> 你不调用脚本、不输出状态 JSON。Harness 在**每次激活时**运行 `session reset`…
```

生成/对标风格时再打开：

```174:179:.cursor/skills/skill-builder/SKILL.md
## 参考资料（按需读取）

- 模板 → `templates/`
- 设计文档 → `templates/design-doc-template.md`
- 风格参考 → `examples/good-skill-sample.md`
```

**生成目标 Skill 时**：`SKILL.md` 自包含行为说明；`references/` / `templates/` / `examples/` 按需；不要写「必须先读完全部子文件」。

---

### 1.4 结构化（元数据 · 运行时状态 · 脚本校验）

**是什么**  
Skill 不只是散文：静态定义「要收集什么」，运行时记住「做到哪」，脚本保证「能不能往下走 / 产物合不合格」。

**如何实现**  
静态字段定义 + 可落盘/可摘要的进度 + Loop 或完成条件门禁 + 落盘后结构校验。L1 可用对话内 `*_record` 摘要；L3 用 `.meta/` + 脚本。

**skill-builder 怎么做**

**（1）静态：create 要收集哪些字段、谁必填、怎么校验。**

```1:10:.cursor/skills/skill-builder/.meta/requirements_schema.json
{
  "version": "2.5.0",
  "create": [
    {
      "id": "skill_name",
      "label": "Skill 名称",
      "description": "kebab-case 格式，如 pr-description-builder",
      "required": true,
      "validate": "kebab_case"
    },
```

**（2）运行时 Loop：pending → 提问；齐了 → 等人确认；确认 → `can_exit`。AI 不自写 while。**

```50:79:.cursor/skills/skill-builder/scripts/loop_guard.py
    if pending:
        nxt = pending[0]
        state["next_action"] = {
            "type": "ask_question",
            "requirement_id": nxt["id"],
            "message": build_ask_message(nxt),
        }
        state["can_exit"] = False
        return state

    if not state.get("user_confirmed", False):
        state["next_action"] = {
            "type": "wait_for_confirmation",
            "message": "请核对 clarify_record 摘要，回复「确认」进入 design，…",
        }
        state["can_exit"] = False
        return state

    state["next_action"] = {"type": "exit_to_design"}
    state["can_exit"] = True
```

**（3）产物校验：build 后 Harness 跑清单 + 结构脚本。**

```51:57:.cursor/skills/skill-builder/.harness/flow.yaml
validations:
  after_build:
    - type: checklist
      path: scripts/skill-self-check.md
    - type: command
      run: deno run -A .cursor/skills/skill-builder/scripts/validate-skill-structure.ts
      arg: target_skill_dir
```

**生成目标 Skill 时**：  
- 至少：阶段完成条件写清 + `schema.json#post_validations` 或自检清单。  
- 多轮澄清：优先「元数据记录 + 退出前门禁」；复杂度够再升到 L3（可抄 skill-builder 的 `.meta` / loop 模式）。

---

### 1.5 可观测性

**是什么**  
随时能回答：阶段、缺口、下一步、失败原因；最好可打开、可测。

**如何实现**  
进度可导出或可展示摘要；关键路径用断言测「下一步动作」，不止看聊天语气。

**skill-builder 怎么做**  
测试子进程调 CLI，断言初始化后第一问必须是 `skill_name`：

```25:32:.cursor/skills/skill-builder/tests/clarify-loop.test.ts
Deno.test("clarify_loop create flow reaches exit_to_design after confirm", async () => {
  let r = await runClarifyLoop(["clarify", "init", "--mode", "create"]);
  ...
  const next = state.next_action as Record<string, string>;
  if (next?.type !== "ask_question" || next?.requirement_id !== "skill_name") {
    throw new Error(`expected ask skill_name, got ${JSON.stringify(next)}`);
  }
```

**生成目标 Skill 时**：至少提供交互示例覆盖主路径；L2+ 建议 fixture 或自检清单条目可勾选。

---

### 1.6 澄清交互（逐项 · 自然语言）

**是什么**  
向用户收集信息时，像对话，不像填表引擎报错。每轮只推进一项；用语白话；内部字段名留在状态机里，不上桌面。

**如何实现**

| 要做 | 不要做 |
|------|--------|
| 每轮 **最多 1** 个待填主问题 | 「本轮补这 5 项」清单催填 |
| 一句模式/进度导向 + 人话问句 + 括号短例 | 用 `` `task_scope` ``、`` `goal` `` 等 id 当面点名 |
| 「接下来：…」可预告下一问，但仍只等当前答 | 「若已知也可顺带写上」一堆选填，逼用户一次答完 |
| 齐项后用人话摘要再确认 | 甩 JSON / `clarify_record` 原文给用户改 |

**skill-builder 怎么做**  
Loop 脚本 **每轮只发一个** `ask_question`（见 `loop_guard.py`）；Agent 用自然语言包装 `message`：

```190:208:.cursor/skills/skill-builder/SKILL.md
## 交互示例

**系统注入** `next_action: ask_question(skill_name)`：

进入 create 模式，先确认名称。

请提供 Skill 名称（kebab-case，例如 pr-description-builder）：

接下来：这个 Skill 主要解决什么问题？（一两句话即可）
```

**生成目标 Skill 时**：凡含多轮澄清的 Skill（含 L1 的对话内 `*_record`），`SKILL.md` 须：

1. 设计原则或澄清步骤里写明「每轮 1 问 · 自然语言」  
2. 自检 Loop 写 `每轮最多 1 个`，禁止 `最多 5 个` 这类批问  
3. 「交互示例」至少一段符合上表「要做」；不得把「字段 id 清单催填」当正例  

反例（禁止写入目标 Skill）：

```
clarify_record（new）目前几乎空白。本轮请补这 5 项：
task_scope：…
goal：…
若已知，也可顺带写上 non_goals、constraints…
```

---

## 2. 结构

### 2.1 主文件 `SKILL.md`

**是什么**  
给模型的行为说明书：当前动作怎么执行；不是调度员手册或状态库。

**如何实现**  
写原则、阶段、动作表（或步骤完成条件）、示例、注意事项。禁止「你必须跑某某 hook/validate」。

**skill-builder 怎么做**  
模型只查表执行；状态更新与出阶段由系统侧负责：

```82:90:.cursor/skills/skill-builder/SKILL.md
2. **执行 `next_action`**：

| `next_action.type` | 你的操作 |
|--------------------|----------|
| `ask_question` | 向用户提出 `next_action.message`，等待回答 |
| `wait_for_confirmation` | 展示 `clarify_record` 摘要… |
| `exit_to_design` | 无需额外操作；Harness 切换阶段… |

3. **用户回答后**：用自然语言回应即可；**不要**自行更新状态表…
```

**生成目标 Skill 时**：若无注入状态机，用「步骤表 + 完成条件 + 用户确认门禁」等价表达；仍不得把系统脚本写成 Agent 义务。

---

### 2.2 约束层

#### 2.2.1 契约

**是什么**  
机器可读调用面。

**如何实现**  
`schema.json`；编排配置挂上契约路径。

**skill-builder 怎么做**  
`inputs` 见 1.2。Harness 知道契约与 `.meta` 在哪：

```59:62:.cursor/skills/skill-builder/.harness/flow.yaml
contract:
  schema: schema.json
  metadata: metadata.yaml
  meta_dir: .meta/
```

**生成目标 Skill 时**：必有 `schema.json`（至少 `inputs` / `outputs` / `security`）。

---

#### 2.2.2 Harness 编排

**是什么**  
「何时 reset、注入、切阶段、跑校验」由调度层决定。

**如何实现**  
`flow.yaml`（或等价文档）声明 pipeline 与命令；无 Harness 时由用户/CI 按同一契约执行后置校验。

**skill-builder 怎么做**  
create 固定 clarify→design→build；会话先 reset；退出看 `can_exit`：

```4:29:.cursor/skills/skill-builder/.harness/flow.yaml
modes:
  create:
    pipeline: [clarify, design, build]
loop_engine:
  session:
    reset: python scripts/clarify_loop.py session reset --mode {mode}
  clarify:
    status: python scripts/clarify_loop.py clarify status
    parse_reply: python scripts/clarify_loop.py clarify parse --text "{user_text}"
    exit_when: can_exit
    inject_template: "{{CLARIFY_STATE}}"
```

**生成目标 Skill 时**：L2+ 建议 `.harness/flow.yaml` + hooks；L1 至少在 `schema.json#post_validations` 写明校验命令。

---

#### 2.2.3–2.2.5 参考文档 / 模板 / 正反例

**是什么**  
深度规范、产出骨架、质量上下界；默认非热路径。

**如何实现**  
`references/`、`templates/`、`examples/`；主文「按需」指引。

**skill-builder 怎么做**（生成阶段再读）：

| 类型 | 路径 |
|------|------|
| 规范 | `references/skill-engineering-spec.md`（本文之上） |
| 模板 | `templates/skill-md-template.md`、`design-doc-template.md` |
| 样例 | `examples/good-skill-sample.md`、`bad-skill-sample.md` |

主文点名方式见 1.3「参考资料」代码块。

**生成目标 Skill 时**：有固定产出格式就给 template；有质量争议就给 good/bad 样例。

---

### 2.3 数据层

#### 2.3.1 注册元数据

**是什么**  
户籍：模式、阶段、依赖；一般不存本次会话进度。

**如何实现**  
`metadata.yaml` 本地声明模式与阶段；不引入本仓库不存在的 registry 路径。

**skill-builder 怎么做**  
本地声明 mode/phase 与 reset 入口：

```yaml
# metadata.yaml（摘录）
modes: [create, iterate]
phases: [clarify, design, build]
loop_engine:
  session_reset: scripts/clarify_loop.py session reset --mode <mode>
  meta_dir: .meta/
```

**生成目标 Skill 时**：建议 `metadata.yaml`；registry patch 仅建议，默认不写。

---

#### 2.3.2 运行时数据

**是什么**  
本次会话进度；新会话勿沿用上次残留。

**如何实现**  
状态文件或对话内强类型摘要；激活时 reset；仅脚本或约定门禁写入。

**skill-builder 怎么做**  
进 Skill 先清空 design/build，再 init clarify：

```201:208:.cursor/skills/skill-builder/scripts/state_manager.py
def reset_runtime_states(mode: str) -> dict[str, Any]:
    """
    Reset all phase runtime files for a new skill-builder session.
    Returns fresh clarify state (without next_action; caller runs loop_guard).
    """
    reset_idle_design_state(mode)
    reset_idle_build_state(mode)
    return init_clarify_state(mode)
```

design 重置为空闲壳，避免串会话：

```160:177:.cursor/skills/skill-builder/scripts/state_manager.py
def reset_idle_design_state(mode: str | None = None) -> dict[str, Any]:
    state = {
        "current_phase": "design",
        "design_record": {
            "design_doc": "",
            "target_dir": "",
            "file_plan": [],
            "schema_draft": {},
        },
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("design", state)
```

**生成目标 Skill 时**：有多阶段确认则引入 `*_record`；有持久状态则必须定义 reset 时机。

---

### 2.4 运行时

#### 2.4.1 钩子

**是什么**  
进入/退出固定步骤。

**如何实现**  
`pre` / `post` 由系统执行；标明「Agent 不读」。

**skill-builder 怎么做**  

```9:16:.cursor/skills/skill-builder/hooks/pre-execution.md
| Step 4 🔒 | 运行 `session reset --mode <mode>`（清空三阶段 `.meta/*_state.json`） | … |
| Step 5 🔒 | 运行 `clarify_loop.py clarify status`，注入 `{{CLARIFY_STATE}}` | … |
```

**生成目标 Skill 时**：有 Harness 就写 hooks；否则把「进入时要确认的事 / 结束时要汇总的事」写进 `schema` 的 pre/post，勿写进 Agent 正文当脚本。

---

#### 2.4.2 Loop 校验

**是什么**  
多轮时用确定性逻辑决定下一问与退出。

**如何实现**  
pending → next_action → can_exit；必填未齐禁止出阶段。

**skill-builder 怎么做**  
见 1.4 `loop_guard.py`；模型侧只认动作表（2.1）。

**生成目标 Skill 时**：无脚本则用「缺字段列表 + 禁止进入下一阶段直至确认」写在正文；有脚本则禁止模型自维护循环。

---

#### 2.4.3 状态管理脚本

**是什么**  
统一读写状态、解析回答、暴露 CLI。

**如何实现**  
state 模块 + parser + 单一入口；flow 映射命令。

**skill-builder 怎么做**  
用户回复不手改 JSON，而走 parse：

```22:25:.cursor/skills/skill-builder/.harness/flow.yaml
  clarify:
    status: python scripts/clarify_loop.py clarify status
    parse_reply: python scripts/clarify_loop.py clarify parse --text "{user_text}"
```

等价手敲：

```bash
python scripts/clarify_loop.py session reset --mode create
python scripts/clarify_loop.py clarify parse --text "pr-description-builder"
python scripts/clarify_loop.py clarify confirm
```

**生成目标 Skill 时**：L3 可抄此目录与命令形状；L1/L2 可只用自检 markdown。

---

### 2.5 测试

**是什么**  
证明脚手架按契约工作。

**如何实现**  
主路径 + 非法输入 + fixture；断言状态字段。

**skill-builder 怎么做**  
主路径见 1.5。非法名称必须失败：

```python
# requirement_parser.py（apply 严格路径）
if req.get("validate") == "kebab_case":
    value = validate_kebab_case(text)
    if not value:
        return False, "skill_name 须为 kebab-case（如 pr-description-builder）"
```

**生成目标 Skill 时**：至少自检清单；有脚本则加最小自动化测试或文档化手工 E2E。

---

## 3. skill-builder 生成时强制检查

design / build 阶段必须对照：

1. **description** = 定义 + 触发 + 不触发（无流程长文）  
2. **yaml** 无 `parameters`；契约在 `schema.json`  
3. **SKILL.md** = AI 行为说明；无「执行 hook / 跑 validate」义务句  
4. **分层目录**职责清晰（约束 / 数据 / 运行时 / 测试按级别选取）  
5. **完成门禁**：阶段完成条件可判定；多轮有确认  
6. **澄清交互**：逐项 · 自然语言（§1.6）；交互示例不得教批问/字段 id 催填  
7. **安全**：未确认不覆盖；不自动写 registry / constitution  
8. **本文与 skill-builder 对位**：复杂模式优先复用 skill-builder 的「说明 + 代码形状」，而非另起一套哲学  

自检清单：`scripts/skill-self-check.md`。结构门禁：`scripts/validate-skill-structure.ts`。

---

## 4. 读法小结

| 顺序 | 内容 |
|------|------|
| 1 | 通用原则（是什么） |
| 2 | 落地做法（如何实现） |
| 3 | skill-builder 意图说明 + 代码（参照实现） |
| 4 | 生成目标时的裁剪要求（各级别） |

*权威文档 | v1.1.0 | 与 skill-builder 2.6.0 对齐*
