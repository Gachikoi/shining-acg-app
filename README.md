# 简介

# 需求文档

# 设计稿

# 项目架构

## 技术选型

### 前端

运行时&包管理工具：deno
UI 框架：svelte
构建框架：sveltekit
UI 组件库：shadcn-svelte
css 预处理器：tailwindcss

### 后端

### iOS

### 鸿蒙

### 安卓

## 开发人员

# 版本控制办法（Git & GitHub）

## 分支管理模型

本项目采用简化后的 Git Flow 模型进行版本控制：

- main：主分支。正式发布的产品。只有经过严格审核测试后的 develop 或 hotfix 分支可以合并到 main。代码 push 到此分支后，会经过 github actions 变更生产环境，直接影响到用户！

- develop：开发分支。从 main 创建，不能直接开发，是功能开发的基础分支。代码 push 到此分支后，会经过 github actions 变更测试环境，然后即可在测试环境中验证功能。此外，出于便捷考虑，能够由一个 commit 完成修复的小 bug 可以直接在 develop 分支上进行修复，更大的 bug 请移步至 feature 或 hotfix 分支。

- feature：功能分支。从 develop 分支创建，直接进行功能开发，开发测试完成后会合并到 develop 分支。

- hotfix：热修复分支。当 main 出现紧急 bug 时，基于 main 创建分支进行热修复，修复完成后合并到 develop 和 main 分支。

main、develop 分支有且仅有一个，并且受到严格的分支保护。feature、hotfix 分支命名方式为：`[分支类型]/[名称]`，如 `feature/add_live_photo_support`。

## 分支保护

为保证提交历史线性，仓库已禁用了 merge，只能使用 squash / rebase 进行 pull request。

其他规则：

- main：禁用 push，只能通过 pull request 更新 repository；pull request 在流水线通过之后才能合入 main 分支。
- develop：禁用 force push；pull request 在流水线通过之后才能合入 develop 分支。

## commit 限制