# 计划格式

写入前必须向用户展示（等待 `APPROVED`，除非用户已声明默认批准）：

```markdown
任务：`<task_id>` — <title>
依据：<组件详述路径>；（可选）<area _index>
读法：分析 → 实现契约（或旧格式回退，已 warning）
对照：
- 方块/样子：<分析层模块要点>
- 交互：<回调名列表>
改动文件：
- `<path>`：<做什么>
QA：`.specs/<area>/<slug>/qa/<task_id>.md`
非目标：<本期不做 + 其他任务>
验证：
- `<command>`

等待 `APPROVED`。
```

不要把「对照」写成必须命中的 Tailwind class 清单；视觉按分析意图映射项目约定即可。
