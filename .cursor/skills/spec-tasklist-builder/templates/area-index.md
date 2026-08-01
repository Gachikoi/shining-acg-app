# {{AREA_TITLE}}

> 子需求编排（短）。组件详述见同目录或二级 `<module>/` 子目录（子组件，非方块）。  
> **不写**方块级样子；样子在各组件详述的「分析」层。  
> Agent：主 Spec →（可选）本文件 → 任务行 `spec` 指向的组件文件（先分析后契约）。

- **id**: `{{AREA_ID}}`
- **设计源**: [`{{DESIGN_PATH}}`]({{DESIGN_PATH}})
- **职责**: {{AREA_ROLE}}
- **子组件**:
  - [`{{COMP_1_ID}}`]({{COMP_1_FILE}}) — {{COMP_1_NAME}}
  - [`{{COMP_2_ID}}`]({{MODULE}}/{{COMP_2_FILE}}) — {{COMP_2_NAME}}
- **编排交互**:
  1. {{ORCH_1}}
  2. {{ORCH_2}}
- **复用关系**: {{REUSE}}
