# Commit Message 规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## 类型（Type）

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 仅文档更改
- `style`: 不影响代码含义的更改（空格、格式化、缺少分号等）
- `refactor`: 既不修复 bug 也不添加功能的代码更改
- `perf`: 提高性能的代码更改
- `test`: 添加缺失的测试或更正现有测试
- `build`: 影响构建系统或外部依赖的更改
- `ci`: 对 CI 配置文件和脚本的更改
- `chore`: 其他不修改 src 或测试文件的更改
- `revert`: 恢复之前的提交

## 示例

### 简单示例

```bash
feat: add user authentication
fix: resolve api cors issue
docs: update README installation steps
style: format code with prettier
refactor: reorganize project structure
perf: optimize database queries
test: add unit tests for user service
build: upgrade dependencies
ci: add github actions workflow
chore: update .gitignore
```

### 带作用域（Scope）

```bash
feat(frontend): add dark mode toggle
fix(backend): resolve database connection issue
docs(api): update endpoint documentation
```

### 带详细描述

```bash
feat: add user authentication

Implement JWT-based authentication system with:
- Login and registration endpoints
- Token refresh mechanism
- Password hashing with bcrypt

Closes #123
```

## 规则

1. **类型必须小写**
2. **描述首字母小写**
3. **描述不超过 100 个字符**
4. **使用命令式语气**（如 "add" 而不是 "added" 或 "adds"）
5. **不要以句号结尾**
