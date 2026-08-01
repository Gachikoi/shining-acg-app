# skill-builder 运行时元数据

Harness 与 `scripts/clarify_loop.py` 维护本目录状态；Agent **不直接写入**。

| 文件 | 说明 |
|------|------|
| `requirements_schema.json` | create/iterate 需求项定义（静态） |
| `clarify_state.json` | clarify 阶段状态 + `next_action` |
| `design_state.json` | design 阶段状态 |
| `build_state.json` | build 阶段状态 |

## 新会话 Reset（每次激活必跑）

**每次** skill-builder 被激活时，Harness 必须先执行：

```bash
python scripts/clarify_loop.py session reset --mode <create|iterate>
```

效果：

1. `design_state.json`、`build_state.json` 恢复为空闲壳（清空上次任务的 design_doc、files_done 等）
2. `clarify_state.json` 按 mode 重新 `init`，并重算 `next_action`

`clarify init` 与 `session reset` 等价（内部均调用 `reset_runtime_states`）。

## Harness 每轮流程（clarify）

1. `session reset --mode <mode>`（仅首轮）
2. `clarify status` → 注入 `{{CLARIFY_STATE}}`
3. Agent 按 `next_action` 与用户对话
4. `clarify parse --text "..."` 或 `apply --id --value`
5. 重复 2–4 直到 `can_exit === true`
