# 设计源（按业务域）

本目录按业务域保存供 Spec 引用的设计截图或结构化设计文件。在线 Figma 链接只作人工参考，不能替代仓库内设计源。

```text
.design/
  notification/
    main/image.png
    message/image.png
  <area>/
    <page-or-state>/
      image.png
```

## 约定

1. 新设计按业务域和页面/状态分目录，文件名保持稳定。
2. Spec 每个页面、Tab 和组件节点都应链接真实设计路径。
3. 主 Spec 任务行的 `design` 字段是实现该任务时的唯一设计指针。
4. 设计文件缺失、为空或与 Spec 冲突时停止业务写入并询问，不猜测在线稿。
5. UI 由 `implement-from-spec` 按任务行 `design` 与组件详述落地，范围不得超出当前 `task_id`。
