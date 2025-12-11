# Android

Shining ACG App Android 应用，使用 Kotlin + Jetpack Compose 构建。

## 开发环境

- Android Studio Hedgehog | 2023.1.1+
- JDK 17+
- Android SDK API 34+

## 开发

1. 使用 Android Studio 打开 `packages/android` 目录
2. 等待 Gradle 同步完成
3. 连接 Android 设备或启动模拟器
4. 点击运行按钮

## 构建

```bash
# Debug 构建
./gradlew assembleDebug

# Release 构建
./gradlew assembleRelease
```

## 项目结构

```
app/
├── src/main/
│   ├── kotlin/com/shining/acgapp/
│   │   └── MainActivity.kt
│   ├── res/
│   └── AndroidManifest.xml
└── build.gradle.kts
```

## 技术栈

- Kotlin
- Jetpack Compose - 现代 Android UI 工具包
- Material 3 - Material Design 3 组件
- Gradle - 构建工具
