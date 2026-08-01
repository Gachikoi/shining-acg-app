# 人测 QA 与 TEMP MOCK

## 人测 QA（步骤五）

落点：`.specs/<area>/<slug>/qa/<task_id>.md`（与 Spec 同 slug、按任务一篇）。

按本任务组件验收 / 事件表拆功能点；每节固定：

1. **功能点简介**
2. **如何测试**（入口路由、操作步骤、前置/mock 数据；给人点 UI）
3. **怎样算通过**（可勾选的可见/交互结果）

文档头：`task_id`、关联 `spec` 详述、mock 依赖说明。无可视 UI 的任务仍须写可观察行为（可注明「无可视交互」）。

模板见 `templates/qa-task.md`。**标 `done` 前必须已存在该文件。**

## TEMP MOCK

尚无真实 API 时，mock 文件/开关须含：

```ts
/** TEMP MOCK: 人测/联调占位，对接真实 API 后删除。关联 QA: .specs/<area>/<slug>/qa/<task_id>.md */
```

QA「如何测试」须写明用到的 mock 场景（空态 / 错误 / 有数据等）。

禁止无注释临时 mock；禁止把 mock 写入 Skill 目录（`.cursor/skills/**`）。
