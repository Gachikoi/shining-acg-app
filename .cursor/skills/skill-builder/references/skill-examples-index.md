# 已有 Skill 的结构索引

> 用途：`skill-builder` 的 `design` 流程在推断新 Skill 的流程分支时（Step 4），读取本文件对照参考，  
> 避免重复造轮子，复用已验证的结构模式。
>
> 维护说明：每次新增 Skill 后，手动或由 skill-builder 在 build 完成时自动追加一行。

---

## 本仓库已有 Skill 索引

| Skill 名称 | 目录路径 | 主要流程 | 触发词摘要 | 目录结构特点 |
|-----------|---------|---------|----------|------------|
| `interview-qa-builder` | `.catpaw/skills/interview-qa-builder/` | fill（填写答案）/ simulate（模拟追问）/ scan（全量扫描）| 「补充答案」「模拟追问」「扫描空白」「面试备考」| references+resources+examples+scripts 四类目录；code-location-map.json 结构化映射 |
| `phx-im-knowledge-qa` | `.catpaw/skills/phx-im-knowledge-qa/` | 知识库问答（单流程）| 「某功能在哪里」「数据怎么来的」「某卡片怎么实现」| 轻量级，无子目录；知识库直接在 SKILL.md 中描述 |
| `new-phx-message-card` | `.catpaw/skills/skills-market/new-phx-message-card/` | 生成消息卡片模板（单流程）| 「新建卡片」「新增消息卡片」「create message card」| skills-market 子目录；面向代码生成场景 |
| `phx-im-card-mrn2msc` | `.catpaw/skills/skills-market/phx-im-card-mrn2msc/` | 迁移卡片到 MSC / 修复卡片问题 / 批量回归验证（三流程）| 「迁移卡片到msc」「fix card」「回归卡片」| skills-market 子目录；多流程，含修复和验证流程 |
| `skill-builder` | `.catpaw/skills/skill-builder/` | clarify（需求澄清）/ design（设计方案）/ build（逐步生成文件）（三流程）| 「帮我开发一个新 skill」「create skill」「帮我写 SKILL.md」| 元 Skill；references+templates+examples+scripts 四类目录；templates 目录是特色 |

---

## 结构模式参考

| 模式类型 | 代表 Skill | 适用场景 | 特点 |
|---------|----------|---------|------|
| **轻量单流程** | `phx-im-knowledge-qa` | 问答/查询类，无需复杂状态管理 | 无子目录，SKILL.md 即全部；快速激活 |
| **三流程标准型** | `interview-qa-builder`、`skill-builder` | 需要「准备→执行→验证」三阶段的复杂任务 | references+examples+scripts 三类目录；自检机制 |
| **代码生成型** | `new-phx-message-card` | 根据用户输入生成特定格式代码 | 以 templates 目录为核心；触发词强调「新建/create」|
| **迁移适配型** | `phx-im-card-mrn2msc` | 将 A 平台内容适配到 B 平台，含回归验证 | 多流程（迁移/修复/验证）；触发词区分创建/修复/验证三场景 |

---

## 全局 Skill 索引（CatPaw 全局安装）

| Skill 名称 | 目录路径 | 主要功能 |
|-----------|---------|---------|
| `citadel` | `~/.catpaw/skills/skills-market/citadel/` | 学城文档操作（读/写/创建/移动） |
| `ops-inspect` | `~/.catpaw/skills/skills-market/ops-inspect/` | 运维日常巡检，Raptor 接口数据分析 |
| `phx-repo-knowledge-builder` | `~/.catpaw/skills/skills-market/phx-repo-knowledge-builder/` | 仓库知识库初始化与升级 |

---

*最后更新：2026-06-27 | 新增 Skill 后请同步追加一行*
