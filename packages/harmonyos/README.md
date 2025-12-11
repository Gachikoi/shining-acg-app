# HarmonyOS

Shining ACG App 鸿蒙应用，使用 ArkTS + ArkUI 构建。

## 开发环境

- DevEco Studio 4.0+
- HarmonyOS SDK API 10+

## 开发

1. 使用 DevEco Studio 打开 `packages/harmonyos` 目录
2. 等待依赖同步完成
3. 连接鸿蒙设备或启动模拟器
4. 点击运行按钮

## 项目结构

```
entry/
├── src/main/
│   ├── ets/
│   │   ├── Application/
│   │   │   └── AbilityStage.ts
│   │   ├── MainAbility/
│   │   │   └── MainAbility.ts
│   │   └── pages/
│   │       └── Index.ets
│   ├── resources/
│   └── module.json5
```

## 技术栈

- ArkTS - TypeScript 超集
- ArkUI - 声明式 UI 框架
- HarmonyOS SDK
