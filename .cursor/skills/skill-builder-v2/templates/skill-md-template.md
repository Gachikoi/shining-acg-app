---
name: "{{SKILL_NAME}}"
description: |
  {{SKILL_WHAT}}
  触发：{{SKILL_TRIGGERS}}
  不触发：{{SKILL_NON_TRIGGERS}}
version: "1.0.0"
---

# {{SKILL_NAME}}

{{PERSONA}}：要完成{{TASK}}。接收{{INPUT_SUMMARY}}；基于输入做{{PROCESS_SUMMARY}}；输出{{OUTPUT_SUMMARY}}。

## 原则

1. {{PRINCIPLE_1}}
2. {{PRINCIPLE_2}}
<!-- 多轮澄清时：每轮只问 1 项，用人话提问 -->

## 流程

### 步骤一：{{STEP_1_NAME}}

做什么：{{STEP_1_DO}}
输出：{{STEP_1_RESULT}}
<!-- 若用户要求保证正确性，取消下一行注释并填写 -->
<!-- 校验：{{STEP_1_CHECK}} -->

### 步骤二：{{STEP_2_NAME}}

做什么：{{STEP_2_DO}}
输出：{{STEP_2_RESULT}}
<!-- 校验：{{STEP_2_CHECK}} -->

<!-- 按需继续 ### 步骤三：… 格式同上；每步必须含「做什么」与「输出」；正确性开启时每步必须含「校验」 -->

## 边界

- {{BOUNDARY_1}}
- {{BOUNDARY_2}}

## 参考资料（按需读取）

<!-- 无额外文件时可删除本段 -->
- {{REF_1}}

## 注意事项

- {{NOTE_1}}
- {{NOTE_2}}
