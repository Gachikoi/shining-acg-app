# 交互正例（节选）

说明：真实会话每轮只问一项；此处压缩展示形态。

---

**用户：** `/skill-builder-v2`

**Agent：**  
进度：（当前问：名字）

请提供 Skill 名称（kebab-case）。若还没想好，可以说功能，我帮你拟 1–2 个候选。

---

**用户：** 做一个根据 diff 写 PR 描述的

**Agent：**  
进度：（当前问：名字）

根据功能，建议：

- A：`pr-description-builder`
- B：`pr-desc-from-diff`

选 A/B，或自定义名称。

---

**用户：** A

**Agent：**  
进度：名字✓（当前问：功能）

收到，名称：`pr-description-builder`。

请用一两句话确认功能（人设 + 要完成的任务）。例如：「你是 PR 描述助手：根据 git diff 生成符合团队模板的 PR 正文。」

---

（…依次确认触发词 → 输入 → 输出 → 流程 → 边界 → 正确性…）

**Agent（流程轮）：**  
进度：名字✓ 功能✓ 触发词✓ 输入✓ 输出✓（当前问：流程）

按功能拟了两套流程，请选或改：

**A 澄清→执行→交付**  
1. 收集 diff 范围 → 得到 diff 文本  
2. 按模板起草 → 得到 PR 草稿  
3. 展示并按需落盘 → 得到最终描述  

**B 计划→批准→执行**  
1. 收集 diff  
2. 展示将用的模板与章节计划  
3. 用户确认后生成  
4. 自检章节完整性  

回复 A、B，或「基于 A，加上…」。

---

**Agent（摘要后）：**  
信息已齐。确认后将写入：

- `.cursor/skills/pr-description-builder/SKILL.md`
- `.cursor/skills/pr-description-builder/schema.json`（因输入含结构化字段）

回复「确认」开始生成。
