# 页面 · 我的主页壳

> 子需求编排（短）。组件详述见同目录或二级 `<module>/` 子目录。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件。

- **id**: `profile.page.shell`
- **设计源**: [`.design/profile/mine-profile/image.png`](../../../../.design/profile/mine-profile/image.png)
- **职责**: 在现有 App 壳内提供我的主页主内容容器，挂载资料头与内容区。
- **子组件**:
  - [`profile.page.shell`](shell.md) — 我的主页路由壳
- **编排交互**:
  1. 壳仅布局：上方资料头槽、下方内容区槽。
  2. 不实现侧栏/顶栏；活动导航「我」由现有 App 壳负责。
- **复用关系**: 复用 App Header、侧栏、底栏；不得复制全局搜索逻辑。
