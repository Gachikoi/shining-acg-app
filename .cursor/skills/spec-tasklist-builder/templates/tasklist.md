# （已并入主 Spec）

任务表与进度写在主文件 `.specs/<area>/<slug>.spec.md` 的「任务与进度」章节，**不再**单独维护 `.tasks.md`。

列约定：

| 列 | 含义 |
|----|------|
| `id` | 与组件详述文件同 id |
| `title` | 任务标题 |
| `status` | `todo` \| `doing` \| `done` \| `blocked` \| `unknown` |
| `design` | 设计源路径 |
| `spec` | 相对主文件的组件详述路径（可含 `<module>/`；文件内为分析 + 实现契约双层） |
| `files` | 已实现代码路径 |
| `notes` | 备注 |

创建时请直接填充 `templates/spec.md` 的任务表，勿再生成独立 tasks 文件。
