# spec-tasklist-builder 自检

- [ ] 主文件含：目标描述 / 技术约束 / 功能需求索引 / 任务与进度 / 验收标准
- [ ] 主文件**不含**完整组件分析/契约详述
- [ ] 子需求均有 `<slug>/<area-dir>/_index.md`（短编排；无方块级样子）
- [ ] 每个可开发组件均为独立详述文件，含 **分析**（目标 / 模块方块+样子 / 交互意图）与 **实现契约**（状态 / 边界 / 事件表 / 组件验收）及 **子组件 (`children`)**（无则标明 `无`）
- [ ] 分析层样子为自然语言（见 `references/visual-language.md`）；未默认灌满 Tailwind / px
- [ ] 实现契约交互为事件表 + 回调名；可选 class 已标「参考（非强制）」
- [ ] 落盘仅为扁平或 `area-dir/<module>/` 一级嵌套；无更深目录、无超长扁平拼接文件名；方块未单独成文件/任务
- [ ] 主文件任务表每行有 `spec` 指向对应详述（路径含可选 module）；id 一一对应
- [ ] 未再新建独立 `.tasks.md`（或仅留废弃跳转）
- [ ] 澄清每轮最多 1 问；视觉不清问意图不逼问 class；落盘前有用户确认
- [ ] `iterate` 触达的详述已升双层；未批量改写冻结旧 Spec（除非用户要求）
- [ ] 未实现业务 UI/逻辑；未手改 `packages/web/src/lib/api/**`
- [ ] outputs 含 status / artifacts / open_questions / self_check / warnings
