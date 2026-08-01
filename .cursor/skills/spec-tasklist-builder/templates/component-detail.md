# `{{COMP_ID}}` — {{COMP_NAME}}

> 单组件详述（方案 C：同文件双层）。**分析**写怎么拆与样子（自然语言）；**实现契约**写可编码门禁。  
> 落盘（二选一）：  
> - `.specs/<area>/<slug>/<area-dir>/<component>.md`  
> - `.specs/<area>/<slug>/<area-dir>/<module>/<component>.md`（二级嵌套 · 子组件，非方块文件）

- **设计源**: [`{{DESIGN_PATH}}`]({{DESIGN_PATH}})
- **父节点**: `{{PARENT_ID}}`
- **子组件** (`children`):
  - [`{{CHILD_1_ID}}`]({{CHILD_1_REL_PATH}}) — {{CHILD_1_NAME}}
  - [`{{CHILD_2_ID}}`]({{CHILD_2_REL_PATH}}) — {{CHILD_2_NAME}}
  - （无子组件时写：`无`）
- **职责**: {{ONE_LINE_ROLE}}

> Agent：本任务只读本文件；先读「分析」，再读「实现契约」。需要实现或接线某个子组件时，再按 `children` 链接向下打开。禁止一次展开整棵子树。两层冲突时以**分析层视觉意图**为准。

## 分析

> 设计意图。禁止默认写死 px 或完整 Tailwind class 串；颜色用语义（中性 zinc、主强调 red）。样子写法见 `references/visual-language.md`。

### 目标

{{ONE_OR_TWO_SENTENCE_USER_GOAL}}

### 模块（方块）

#### {{BLOCK_1_NAME}}

- **内容**: {{WHAT_IS_IN_THE_BLOCK}}
- **样子**: {{SHAPE_HIERARCHY_DENSITY_STATE_RESPONSIVE}}
- **局部意图**（可选）: {{OPTIONAL_LOCAL_INTENT}}

#### {{BLOCK_2_NAME}}

- **内容**:
- **样子**:
- **局部意图**（可选）:

### 整体交互意图

- {{INTENT_1}} → `{{CALLBACK_1}}`
- {{INTENT_2}} → `{{CALLBACK_2}}`

### 本期不做 / 待澄清（分析）

- {{ANALYSIS_OUT_OF_SCOPE_OR_OPEN}}

## 实现契约

> 可编码门禁。契约中的 class / 组件名仅可作「参考（非强制）」；验收验行为与是否符合分析描述，不验具体 class 字符串。

### 状态

- {{STATE_FIELD_OR_RUNE}}

### 边界

- {{EMPTY_MISSING_TRUNCATE_ETC}}

### 交互

| 手势/键 | 条件 | 行为 | 回调 / 状态效果 |
|---------|------|------|-----------------|
| 左键单击 | — | | `onXxx(...)` |
| 右键 | 桌面 | | `onXxx(...)` |
| 长按 | 触屏 | | `onXxx(...)` |
| Enter / Space | 聚焦时 | | 同上 |
| Esc | 浮层打开 | 关闭 | `onClose()` |

### 输入约束

- 触控可点区域 ≥ 44×44（`min-h-11 min-w-11`）
- 文本输入 maxlength：{{MAXLENGTH_OR_1000}}

### 可选参考实现

- 参考（非强制）：{{OPTIONAL_TAILWIND_OR_COMPONENT_HINT_OR_无}}

### 本期不做（实现）

- {{IMPL_OUT_OF_SCOPE}}

### 组件验收

- [ ] 方块层次与样子符合「分析」描述
- [ ] {{CALLBACK_OR_BEHAVIOR_AC}}
- [ ] 
