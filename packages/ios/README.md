# iOS

Shining ACG App iOS 应用，使用 Swift + SwiftUI 构建。

## 开发环境

- Xcode 15.0+
- iOS 17.0+
- macOS Sonoma 14.0+

## 开发

1. 使用 Xcode 打开 `packages/ios/ShiningACGApp.xcodeproj`
2. 选择目标设备或模拟器
3. 点击运行按钮 (⌘R)

## 项目结构

```
ShiningACGApp/
├── ShiningACGApp.swift      # App 入口
├── ContentView.swift         # 主视图
└── Assets.xcassets/         # 资源文件
```

## 构建

```bash
# 命令行构建（需要在 Xcode 项目创建后）
xcodebuild -scheme ShiningACGApp -destination 'platform=iOS Simulator,name=iPhone 15' build
```

## 技术栈

- Swift
- SwiftUI - 声明式 UI 框架
- Xcode - 开发工具

## 注意事项

Xcode 在执行 Git 操作（如 commit 触发的 pre-commit hook）时，通常不会加载用户的 shell 配置文件（如 .zshrc），因此无法找到仅在用户 PATH 中定义的 deno。

Xcode 和大多数 GUI 应用默认会查找 bin 路径。你可以将 deno 链接到该目录下。

请在终端中运行以下命令：

```sh
sudo ln -s [使用 which deno 命令找到的 deno 路径] /usr/local/bin/deno

例如：
sudo ln -s /Users/gachikoi/.deno/bin/deno /usr/local/bin/deno
```

运行后，Xcode 应该就能直接识别到 deno 命令了。