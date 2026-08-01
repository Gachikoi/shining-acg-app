---
name: "invalid-missing-schema"
description: |
  故意缺少 schema.json 的反例 fixture。
  当用户说「测试无效 skill」时激活。
version: "1.0.0"
author: "test"
timeout: 60
retry: 1
---

# invalid-missing-schema

## 子文件索引

| 文件 | 内容 | 何时读取 |
|------|------|---------|
| [hooks/pre-execution.md](hooks/pre-execution.md) | 前置 | 激活 |

## 流程路由

```pseudo
function main(): pass
```
