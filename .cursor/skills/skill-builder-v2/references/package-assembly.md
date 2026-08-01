# 目标 Skill 包组装（按需读取）

落盘前阅读。根据对话中已确认的需求决定写哪些文件；生成前先向用户展示清单。

## 落点

- 默认：`.cursor/skills/<skill_name>/`；用户指定路径时从其指定
- 目录已存在：列出将覆盖的文件，等用户确认后再写

## 决策表

| 条件 | 生成 |
|------|------|
| 始终 | `SKILL.md`（严格按 `templates/skill-md-template.md`） |
| 输入/输出为结构化字段或多模式 | `schema.json`（`inputs` / `outputs`） |
| 主文件将明显超长，或有详细规范/API | `references/*.md`，主文件仅链接触发点 |
| 有可填充的文档/报告骨架 | `templates/` |
| 需要演示触发话术或 I/O 样例 | `examples/` |
| 用户要求步骤校验且要自检清单文件 | `scripts/skill-self-check.md`（checklist，非强制脚本） |
| 用户仅要求步骤校验 | 仅在 `SKILL.md` 各步骤写「校验：」 |
| 永不默认 | `.meta/`、`.harness/`、hooks 强制跑 validate、Python loop |

## SKILL.md 组装要点

1. yaml：`name`、`description`（定义+触发+不触发）、`version`；需要显式点名时加 `disable-model-invocation: true`。
2. 开篇人设段：任务、输入、处理、输出（一段话）。
3. `## 流程`：步骤标题用「步骤一 / 步骤二…」或「步骤 N：名称」；每步「做什么」「输出」；若用户要求保证正确性则插入「校验」。
4. `## 边界` 写入已确认的边界；空则写「无额外边界（已确认）」。
5. 有子文件时加「参考资料（按需读取）」；无则省略。

## schema.json（按需）

最小形状：

```json
{
  "name": "<skill_name>",
  "version": "1.0.0",
  "description": "<one line>",
  "inputs": { "type": "object", "properties": {} },
  "outputs": { "type": "object", "properties": { "status": { "type": "string" } } }
}
```

字段与已确认的输入/输出约定对齐；不要把对话流程状态塞进 schema。

## skill-self-check.md（按需）

列出可勾选项，例如：

- [ ] yaml 含 name / description
- [ ] 开篇含人设与 I/O
- [ ] 每步含做什么与输出
- [ ] （若启用）每步含校验
- [ ] 未生成 harness / .meta

生成结束后由 Agent 对照清单自检并报告通过/失败项。

## 生成后自检（本元 Skill 必做）

无论目标 Skill 是否开启正确性校验，v2 自身在步骤十结束时检查：

1. 约定文件均已写入或已说明跳过原因
2. `SKILL.md` 流程步数与摘要确认时的步骤一致
3. 未写入禁止项（`.meta`、harness 等）
4. 向用户返回路径列表与简短使用说明（如何用 `/name` 或触发词激活）
