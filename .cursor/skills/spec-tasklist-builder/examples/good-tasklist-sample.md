# 优质任务清单样例（节选 · 虚构缩小版）

```markdown
# 任务清单：首页 Feed

> 与 Spec `.specs/home/home-feed.spec.md` 同构。

## 进度摘要

| 指标 | 值 |
|------|-----|
| 总计 | 4 |
| done | 1 |
| doing | 0 |
| todo | 2 |
| blocked | 0 |
| unknown | 1 |

---

## Tab · 综合

- **node_id**: `home.tab.main`
- **design**: `.design/home/tab/main.json`
- **spec_anchor**: `.specs/home/home-feed.spec.md` → 功能需求 / Tab · 综合

### 任务

| id | title | status | design | files | notes |
|----|-------|--------|--------|-------|-------|
| `home.tab.main.shell` | 综合 Tab 壳与分区切换 | done | `.design/home/tab/main.json` | `packages/web/src/routes/app/home/+page.svelte` | 已有 SwipeablePane |
| `home.tab.main.filter` | 筛选面板 | todo | `.design/home/tab/main.json` | — | |
| `home.tab.main.card-grid` | 瀑布流卡片区 | unknown | `.design/home/tab/main.json` | `packages/web/src/lib/components/custom/waterfall/waterfall-container/waterfall-container.svelte`, `.../waterfall-card.svelte` | 需对照设计差量 |

---

## Tab · 关注

- **node_id**: `home.tab.subscribe`
- **design**: `.design/home/tab/subscribe.json`

### 任务

| id | title | status | design | files | notes |
|----|-------|--------|--------|-------|-------|
| `home.tab.subscribe.ups` | 作者头像横向筛选 | todo | `.design/home/tab/subscribe.json` | — | 红点数据源待澄清 |
```

**✅ 好在哪里**

1. 任务 id 与 Spec 组件 id 对齐。
2. 已实现项绑定真实 `files`；不确定用 `unknown` 而非假 `done`。
3. 进度摘要可一眼看健康度。
