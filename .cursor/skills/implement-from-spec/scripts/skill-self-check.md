# implement-from-spec 自检

- [ ] 本会话只处理一个 task_id
- [ ] 先读主 Spec 任务表，再只读该行 `spec` 详述（未整包加载分片；`children` 仅按需打开）
- [ ] 详述内先读「分析」再读「实现契约」；若旧格式已按组成/UI 回退并写入 warnings
- [ ] 需要编排时最多追加同 area `_index.md`
- [ ] 实现对照分析层方块意图与契约层事件表回调；未把参考 class 当唯一依据；未发明未写入交互
- [ ] 临时 mock 均含 `TEMP MOCK` 注释并关联 QA 路径（无则 N/A）
- [ ] 写入前已展示计划（含 QA 路径、方块/回调对照）并收到 `APPROVED`（或显式默认批准）
- [ ] 已落盘 `.specs/<area>/<slug>/qa/<task_id>.md`（功能点简介 / 如何测试 / 怎样算通过）
- [ ] 未改写详述分析意图/契约组件验收；未手改 `packages/web/src/lib/api/**`
- [ ] 未创建分支、提交、推送或覆盖无关改动
- [ ] 未将 mock 写入 `.cursor/skills/**`
- [ ] 已跑相关检查与包级 check/lint（失败已改到通过或已 blocked）
- [ ] 仅验收+QA+门禁通过才标 `done`；进度回写含 qa notes
- [ ] 输出含 status / task_id / artifacts（含 QA 路径）/ gates / task_update / warnings
