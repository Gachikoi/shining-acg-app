# 🌅 Shining ACG APP

一个使用 Deno 管理的跨平台 monorepo 项目，包含前端、后端和多个移动端应用。

# 🏗️ 项目结构

```
shining-acg-app/
├── packages/
│   ├── web/              # SvelteKit 前端应用
│   ├── server/           # Go 后端服务
│   ├── android/          # Android 应用 (Kotlin + Jetpack Compose)
│   ├── ios/              # iOS 应用 (Swift + SwiftUI)
│   └── harmonyos/        # 鸿蒙应用 (ArkTS + ArkUI)
├── scripts/              # 构建和工具脚本
|   ├── ci                # 与 CI/CD 相关的脚本
|   └── git-hooks         # 与 git-hooks 相关的脚本
│        ├── format-*.ts       # 代码格式化脚本
│        ├── lint-*.ts         # 代码检查脚本
│        ├── commitlint.ts     # Commit 消息验证
│        ├── pre-commit.ts     # Pre-commit hook
│        ├── commit-msg.ts     # Commit-msg hook
│        └── install-hooks.ts  # Git hooks 安装脚本
├── .github/workflows/    # GitHub Actions CI/CD
├── docs/                 # 项目文档
├── deno.json             # Deno 配置和任务
└── .gitignore            # Git 忽略文件
```

# 🚀 快速开始

## 环境要求

- [Deno](https://deno.land/) deno 2.6.0（用于仓库管理）

## 安装

1. **克隆仓库**

```bash
git clone https://github.com/Gachikoi/shining-acg-app.git
cd shining-acg-app
```

2. **安装 Git Hooks**

```bash
deno task prepare
```

这将自动安装：

- `pre-commit`: 提交前自动格式化和 lint 代码
- `commit-msg`: 验证 commit 消息格式

‼️ 这很重要！！！安装后在提交代码前项目会自动格式化和 lint 代码并规范 commit message。

3. **初始化并开发子项目**

   详见各子项目中的 `README.md`。

# 版本控制办法（Git & GitHub）

## 分支管理模型

本项目采用简化后的 Git Flow 模型进行版本控制：

- main：主分支。正式发布的产品。只有经过严格审核测试后的 develop 或 hotfix
  分支可以合并到 main。代码 push 到此分支后，会经过 github actions
  变更生产环境，直接影响到用户！

- develop：开发分支。从 main 创建，不能直接开发，是功能开发的基础分支。代码 push
  到此分支后，会经过 github actions
  变更测试环境，然后即可在测试环境中验证功能。此外，出于便捷考虑，能够由一个
  commit 完成修复的小 bug 可以直接在 develop 分支上进行修复，更大的 bug 请移步至
  feature 或 hotfix 分支。

- feature：功能分支。从 develop
  分支创建，直接进行功能开发，开发测试完成后会合并到 develop 分支。

- hotfix：热修复分支。当 main 出现紧急 bug 时，基于 main
  创建分支进行热修复，修复完成后合并到 develop 和 main 分支。

main、develop 分支有且仅有一个，并且受到严格的分支保护。feature、hotfix
分支命名方式为：`[分支类型]/[开发人员昵称]`，如 `feature/gachikoi`。

## 分支保护说明

为保证提交历史线性，仓库已禁用了 merge，只能使用 squash / rebase 进行 pull
request。

其他规则：

- main：禁用 push，只能通过 pull request 更新 repository；pull request
  在流水线通过之后才能合入 main 分支。
- develop：禁用 force push；pull request 在流水线通过之后才能合入 develop 分支。

## Commit Message 规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 格式

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

> 注：项目目前仅校验首行（type/scope/description），body/footer 不参与校验。
> 注：建议在开发具体的平台功能时，声明作用域（scope），以便于快速识别改动涉及的模块（如 android, ios, web, server 等）。

### 类型（Type）

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

### 示例

#### 简单示例

```bash
feat: 添加用户认证
fix: 解决 api 跨域问题
docs: 更新 readme 对于安装依赖流程的说明
style: 使用 prettier 格式化代码
refactor: 重新组织项目结构
perf: 优化数据库查询
test: 为用户服务添加单元测试
build: 更新 lodash 依赖
ci: 添加 iOS 部署的 Github Actions
chore: 更新 .gitignore 文件
```

#### 带作用域（Scope）

```bash
feat(web): 添加黑暗模式
fix(server): 修复数据库连接问题
```

#### 带详细描述（description）及 footer

```bash
feat: 添加用户认证模块

实现基于 JWT 认证的登陆系统:
- 登录和注册接口
- 令牌刷新机制
- 使用 bcrypt 进行密码哈

Closes #123
```

# 🧑‍💻 开发人员及联系方式

1. ガチ恋（Gachi），负责前端、iOS、Android、HarmonyOS。

- QQ：1131997238
- 邮箱：1131997238@qq.com
- 微信：mineskura

2. 一只冻鱼，负责后端。

// TODO

# 🔗 相关链接

// TODO

# 🤝 贡献

欢迎提交 Issue 和 Pull Request！

提交前请确保：

1. 代码通过所有格式化和 lint 检查
2. Commit 消息遵循规范
3. 添加必要的测试和文档

---

✧･ﾟ: _✧･ﾟ:_ Shining ACG FanClub _:･ﾟ ✧_:･ﾟ ✧
