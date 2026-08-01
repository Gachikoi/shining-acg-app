# skill-builder E2E 验收场景

## 场景 1：create 完整流水线

- **输入**：「帮我开发一个新 skill」，`mode=create`（或默认）
- **预期**：依次完成 clarify → design → build；产出含 `SKILL.md` + `schema.json`；validate 通过

## 场景 2：iterate 完整流水线

- **输入**：「迭代 skill」，提供已有 `SKILL.md` 路径
- **预期**：clarify 展示现有摘要；design 为差量方案；build 仅变更涉及文件；validate 通过

## 场景 3：iterate 新增流程

- **输入**：对已有 Skill 新增一条流程
- **预期**：差量 diff 确认；自检仍通过

## 场景 4：结构校验失败

- **输入**：对缺 `schema.json` 的 fixture 跑 validate
- **预期**：exit 1
