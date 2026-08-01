# 渐进披露读法

实现任一任务时强制按此顺序读取，禁止一次加载该 slug 下全部详述或整棵 `children` 子树。

1. 只读主 `.specs/<area>/<slug>.spec.md` → 选任务、看进度。
2. 只打开该行 `spec` 列指向的组件详述（路径可为 `area-dir/file.md` 或 `area-dir/module/file.md`）。
3. **在该文件内**：先读 `## 分析`（目标 / 方块+样子 / 交互意图），再读 `## 实现契约`（状态 / 边界 / 事件表 / 验收）。
4. 需要跨组件编排时，再读同 area 的 `_index.md`。
5. 详述中 **子组件 (`children`)** 仅在为实现本任务必须接线/挂载时按需打开对应链接。

主文件的目标、约束、总验收只读；组件详述的**分析层意图**与**契约层组件验收**只读。两层冲突时以分析层视觉意图为准；契约中「参考（非强制）」class 不得当作唯一真相。

## 旧格式回退（冻结 Spec）

若文件**没有** `## 分析` / `## 实现契约`（仍为组成 / UI·Tailwind / 交互单层）：

1. 将旧「组成 + UI」当作分析替代；将旧「交互 + 状态 + 边界 + 组件验收」当作契约替代。
2. 仍可实现，但须在 outputs `warnings` 中写明：`spec format outdated: missing 分析/实现契约; used legacy 组成/UI fallback`。
3. 不得把旧 Tailwind 表改写成双层（那是 `spec-tasklist-builder` iterate 的职责）；本 Skill 不改详述需求正文。
