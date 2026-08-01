# 拆分与命名规则

何时读：inventory 有歧义、重复设计文件、或命名冲突时。

## 渐进披露两维 + 详述双层

| 维度 | 落盘 | 内容量 |
|------|------|--------|
| 子需求（页面/Tab） | `<slug>/<area-dir>/_index.md` | 短：职责、子组件链接、编排、复用 |
| 子功能/组件 | `<slug>/<area-dir>/<component>.md` 或 `.../<module>/<component>.md` | 详：同文件 **分析** + **实现契约** + **children** |

主文件只保留索引 + 任务进度，不内嵌组件详述。

组件内「方块」是分析层结构，不是第三维落盘，也不进任务表。

## 页面 / Tab / 组件 / 方块

1. **页面**：可独立路由或全屏栈层。
2. **Tab**：同一页面内互斥内容面板。
3. **组件**：可独立验收的模块 → 一个详述文件 → 任务表一行。
4. **方块**：组件内的视觉/内容区块 → 只写在「分析 → 模块」，不单独文件、不单独任务。

纯装饰且无独立交互的碎件并入某方块「内容」，不必升成组件。

## id 与目录

```text
<area>.<surface>.<module>[.<leaf>]     # id（点分）
<slug>/<area-dir>/<file>.md            # 扁平
<slug>/<area-dir>/<module>/<file>.md   # 二级嵌套（最多一层 module · 子组件）
```

示例：

| id | 路径 |
|----|------|
| `notification.page.shell.tabs` | `notification-im/page-shell/tabs.md` |
| `notification.tab.messages.conversation-item` | `notification-im/tab-messages/conversation-item.md` |
| `home.tab.main.card.actions` | `home-feed/tab-main/card/actions.md` |

`area-dir` / `module` 建议短横线名（`page-shell`、`tab-messages`、`card`）。

### 何时嵌套

- **扁平**：area 内组件少、同级关系清楚。
- **二级 `<module>/`**：同一父组件下有多个可独立验收子件，或 UI 树明显深于一层。
- **禁止**：`area-dir/a/b/c.md` 三层及以上；禁止超长扁平拼接文件名；禁止为「方块」建目录。

父子关系写在详述的 **父节点** / **子组件 (`children`)**。

## 分析 / 契约写法

- **分析 · 样子**：自然语言（`visual-language.md`）；意图 → 回调名。
- **契约 · 交互**：手势/键 | 条件 | 行为 | 回调名。
- 读不清：标 `待澄清`；澄清问视觉意图，不逼问 class。

## 任务同构

- 每个组件详述文件 → 主文件任务表恰好一行。
- 编排节点若单独成任务，也须有对应详述文件（可与 area 根 id 同名）。
- 禁止任务表出现无详述文件的 id。
- `spec` 列路径必须与真实落盘一致（含可选 `module/`）。

## 澄清优先级

1. 页面边界
2. 重复设计文件权威路径
3. 跨 Tab 复用
4. 未画出的交互
5. 读不清的**视觉意图**（主/次层级、圆角程度、响应行为等；不逼问具体 class）
6. `area` / `slug` / `area-dir` / 是否启用 `<module>/` 命名

## iterate 与旧格式

- `iterate` 触达的组件详述须升到双层（分析 + 实现契约）。
- 未触达的旧单层文件可冻结保留。
