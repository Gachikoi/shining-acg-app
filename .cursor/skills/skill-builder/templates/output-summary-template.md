## {{SKILL_NAME}} 执行摘要

- **status**: {{status}}
- **mode**: {{mode}}
- **artifacts**:
{{#each artifacts}}
  - `{{path}}` ({{type}})
{{/each}}
- **self_check**: {{self_check.passed}}/{{self_check.total}} passed
{{#if self_check.failed_items}}
- **failed_items**: {{self_check.failed_items}}
{{/if}}
- **warnings**:
{{#each warnings}}
  - {{this}}
{{/each}}
- **metrics**: duration_ms={{metrics.duration_ms}}, files_generated={{metrics.files_generated}}
{{#if next_suggested}}
- **next_suggested**: {{next_suggested}}
{{/if}}

---

> 本摘要符合 `schema.json#outputs`。
