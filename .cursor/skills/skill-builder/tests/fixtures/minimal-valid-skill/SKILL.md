---
name: "minimal-valid-skill"
description: |
  最小合规 Skill 样例，用于 validate 脚本测试。
  激活语义：用户要测试最小 skill 结构时使用。
  不激活：其他场景。
  当用户说「测试最小 skill」「minimal skill test」「跑最小样例」「test minimal」「样例 skill」时激活。
version: "1.0.0"
author: "test"
timeout: 60
retry: 1
---

# minimal-valid-skill

## 设计原则

1. 先确认需求，再行动。

## 工作流程

### run

向用户确认目标后返回结果。

## 交互示例

**用户**：测试  
**你**：好的，这是测试响应。

## 注意事项

- 不覆盖未确认文件
