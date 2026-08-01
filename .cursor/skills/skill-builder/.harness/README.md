# Harness 配置（AI 不读取）

本目录由 **Harness / CI** 消费，定义流程控制、钩子与物理校验。  
`SKILL.md` 仅描述 AI 如何与用户协作；分工见 `docs/DESIGN.md`。

## 流程定义

```yaml
# flow.yaml
skill: skill-builder
version: "2.5.0"

modes:
  create:
    pipeline: [clarify, design, build]
  iterate:
    pipeline: [clarify, design, build]

hooks:
  pre: hooks/pre-execution.md
  post: hooks/post-execution.md

validations:
  after_build:
    - scripts/skill-self-check.md
    - command: deno run -A scripts/validate-skill-structure.ts <target_skill_dir>

inputs_schema: schema.json
```

## 执行顺序（系统）

1. `pre` hook：解析 `mode` / `skill_name` / `target_skill_path`，校验 preconditions
2. 调用 Agent（加载 `SKILL.md` 正文）
3. `post` hook：汇总 status / artifacts / metrics
4. `validations`：自检清单 + validate 脚本（失败可标记 partial，不依赖 AI 自觉执行）
