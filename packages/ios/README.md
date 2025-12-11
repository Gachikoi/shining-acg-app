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

由于 iOS 项目需要在 Xcode 中创建，建议：

1. 在 Xcode 中创建新的 iOS App 项目
2. 项目名称：ShiningACGApp
3. 组织标识符：com.shining
4. 界面：SwiftUI
5. 语言：Swift
6. 将项目保存到 `packages/ios` 目录
