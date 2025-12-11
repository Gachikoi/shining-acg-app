# Shining ACG App

[![CI](https://github.com/Gachikoi/shining-acg-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Gachikoi/shining-acg-app/actions/workflows/ci.yml)

一个使用 Deno 管理的跨平台 monorepo 项目，包含前端、后端和多个移动端应用。

## 🏗️ 项目结构

```
shining-acg-app/
├── packages/
│   ├── web/              # SvelteKit 前端应用
│   ├── server/           # Go 后端服务
│   ├── android/          # Android 应用 (Kotlin + Jetpack Compose)
│   ├── ios/              # iOS 应用 (Swift + SwiftUI)
│   └── harmonyos/        # 鸿蒙应用 (ArkTS + ArkUI)
├── scripts/              # 构建和工具脚本
│   ├── format-*.ts       # 代码格式化脚本
│   ├── lint-*.ts         # 代码检查脚本
│   ├── commitlint.ts     # Commit 消息验证
│   ├── pre-commit.ts     # Pre-commit hook
│   ├── commit-msg.ts     # Commit-msg hook
│   └── install-hooks.ts  # Git hooks 安装脚本
├── .github/workflows/    # GitHub Actions CI/CD
├── docs/                 # 项目文档
├── deno.json             # Deno 配置和任务
├── .editorconfig         # 编辑器配置
└── .gitignore           # Git 忽略文件
```

## 🚀 快速开始

### 环境要求

- [Deno](https://deno.land/) 1.x+ (JavaScript/TypeScript 运行时)
- [Go](https://golang.org/) 1.21+ (后端开发)
- [Android Studio](https://developer.android.com/studio) (Android 开发)
- [Xcode](https://developer.apple.com/xcode/) (iOS 开发，仅 macOS)
- [DevEco Studio](https://developer.harmonyos.com/cn/develop/deveco-studio) (鸿蒙开发)

### 安装

1. **克隆仓库**

```bash
git clone https://github.com/Gachikoi/shining-acg-app.git
cd shining-acg-app
```

2. **安装 Git Hooks**

```bash
deno run --allow-read --allow-write --allow-run scripts/install-hooks.ts
```

这将自动安装：

- `pre-commit`: 提交前自动格式化和 lint 代码
- `commit-msg`: 验证 commit 消息格式

3. **初始化各子项目**

```bash
# 后端依赖
cd packages/server && go mod download && cd ../..

# 前端会在运行时自动下载依赖（Deno 处理）
```

## 💻 开发

### 前端 (SvelteKit)

```bash
# 开发服务器
deno task web:dev

# 构建
deno task web:build

# 类型检查
cd packages/web && deno task check
```

### 后端 (Go)

```bash
# 开发服务器
deno task server:dev

# 构建
deno task server:build

# 或直接使用 Go
cd packages/server
go run ./cmd/server
```

### Android

```bash
cd packages/android
./gradlew build

# 或使用 Android Studio 打开 packages/android
```

### iOS

使用 Xcode 打开 `packages/ios` 目录下的项目文件。

### 鸿蒙

使用 DevEco Studio 打开 `packages/harmonyos` 目录。

## 🔧 代码规范

### 格式化

```bash
# 格式化所有代码
deno task format:all

# 仅格式化 JS/TS
deno task format

# 格式化 Go
deno task format:go

# 格式化 Kotlin
deno task format:kotlin

# 格式化 Swift
deno task format:swift
```

### Lint

```bash
# Lint 所有代码
deno task lint:all

# 仅 lint JS/TS
deno task lint

# Lint Go
deno task lint:go

# Lint Kotlin
deno task lint:kotlin

# Lint Swift
deno task lint:swift
```

### Commit 规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

格式：`<type>[optional scope]: <description>`

类型：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试
- `build`: 构建系统
- `ci`: CI/CD
- `chore`: 其他修改

示例：

```bash
git commit -m "feat: add user authentication"
git commit -m "fix(api): resolve cors issue"
git commit -m "docs: update README"
```

详见 [docs/COMMIT_CONVENTION.md](docs/COMMIT_CONVENTION.md)

## 🤖 CI/CD

项目使用 GitHub Actions 进行持续集成和部署：

- **CI Workflow** (`.github/workflows/ci.yml`)

  - 代码格式检查
  - Lint 检查
  - 构建各平台项目
  - Commit 消息验证

- **Release Workflow** (`.github/workflows/release.yml`)
  - 构建生产版本
  - 创建 GitHub Release
  - 上传构建产物

## 📖 技术栈

### 前端

- **框架**: SvelteKit 2.x
- **语言**: TypeScript
- **构建工具**: Vite
- **运行时**: Deno

### 后端

- **语言**: Go 1.21+
- **框架**: Gin
- **工具**: godotenv

### Android

- **语言**: Kotlin
- **UI**: Jetpack Compose
- **构建**: Gradle

### iOS

- **语言**: Swift
- **UI**: SwiftUI
- **工具**: Xcode

### 鸿蒙

- **语言**: ArkTS
- **UI**: ArkUI
- **工具**: DevEco Studio

### 工具链

- **运行时**: Deno (替代 Node.js)
- **包管理**: Deno (npm 兼容)
- **代码格式化**: Deno fmt, gofmt, swiftformat
- **代码检查**: Deno lint, golangci-lint, swiftlint
- **Git Hooks**: 自定义 Deno 脚本
- **CI/CD**: GitHub Actions

## 📝 开发工具安装（可选）

为了更好的开发体验，建议安装以下工具：

```bash
# macOS
brew install golangci-lint swiftformat swiftlint

# 或根据各工具官方文档安装
```

## 📄 许可证

[MIT License](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

提交前请确保：

1. 代码通过所有格式化和 lint 检查
2. Commit 消息遵循规范
3. 添加必要的测试和文档

## 📮 联系

- GitHub: [@Gachikoi](https://github.com/Gachikoi)

---

Made with ❤️ using Deno
