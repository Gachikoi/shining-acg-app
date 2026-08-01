# 状态规则

- 获批开始：`todo` / `unknown` → `doing`（写主文件）。
- 验收 + QA + 门禁通过：`doing` → `done`，填写真实 `files` 与含 qa 的 `notes`。
- 外部依赖缺失：`blocked`，`notes` 写明原因。
- 检查失败仍可修：保持 `doing`。
- 进度只回写主文件任务行（`status` / `files` / `notes` 与进度摘要计数）；`notes` 可含 `qa: .specs/.../qa/<task_id>.md`。
- 无 QA 文档不得标 `done`。
