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

xcode 内置 git 套件无法在 githooks 中找到 deno 路径，请使用命令行提交代码。