---
name: "{{SKILL_NAME}}"
description: {{SKILL_DESCRIPTION_COMPACT}}
version: "1.0.0"
---

# {{SKILL_NAME}}

{{SKILL_TAGLINE}}

<!--
  生成约束（见 skill-builder/references/skill-best-practices.md）：
  - description = 定义 + 触发 + 不触发
  - yaml 仅 name/description/version；参数在 schema.json#inputs
  - 本文是 AI 行为说明，不要写「执行 hook / 跑 validate」
  - 按 L1/L2/L3 裁剪：多轮澄清要有完成门禁；复杂流程可参照 skill-builder 的 next_action 形状
-->

## 设计原则

1. {{PRINCIPLE_1}}
2. {{PRINCIPLE_2}}
3. {{PRINCIPLE_3}}
<!-- 若有多轮澄清，必须含：澄清时每轮只问 1 项，用人话提问，禁止字段 id 清单催填（见 skill-best-practices §1.6） -->

## 工作流程

### {{PHASE_1_NAME}}

| 步骤 | 操作 | 完成条件 |
|------|------|---------|
| 1 | {{STEP_1}} | {{DONE_1}} |

<!-- 每阶段：步骤表 + 完成条件；多轮建议 clarify_record 类摘要 + 用户确认后才进下一阶段 -->
<!-- 澄清 Loop：while missing → 只问 1 个 → 写回；禁止「每轮最多 5 个」 -->

### {{PHASE_2_NAME}}

{{PHASE_2_STEPS_IN_PROSE}}

## 参考资料（按需读取）

- {{REF_1}}

## 交互示例

<!-- 正例须像 skill-builder：导向句 + 单问 + 可选「接下来」预告；禁止 clarify_record/字段 id 批问 -->

{{INTERACTION_EXAMPLE}}

## 注意事项

- {{NOTE_1}}
- {{NOTE_2}}
