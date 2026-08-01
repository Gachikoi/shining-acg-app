# QA · `profile.header.social-links`

- **task_id**：`profile.header.social-links`
- **关联 spec**：`.specs/profile/mine-profile/profile-header/social-links.md`
- **入口**：`/app/profile`
- **Mock 依赖**：有数据 — 哔哩哔哩 / Github / 小红书

> 给人测：按功能点逐步点 UI / 验交互。勾选「通过」列即可。

## 功能点 1 · 外链行展示

### 1. 功能点简介

资料头展示个人外链标签行。

### 2. 如何测试

1. 打开 `/app/profile`，在统计下方查找外链行。

### 3. 怎样算通过

- [ ] 可见「哔哩哔哩」「Github」「小红书」三项（或等价文案）

## 功能点 2 · 外链点击占位

### 1. 功能点简介

本期不真实跳转；点击「暂未开放」。

### 2. 如何测试

1. 点击任一外链。
2. 观察 Toast，确认未打开外站新标签伪装成功。

### 3. 怎样算通过

- [ ] Toast「暂未开放」
- [ ] 浏览器地址栏未跳到外链 URL
