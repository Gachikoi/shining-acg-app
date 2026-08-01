#!/usr/bin/env -S deno run -A
/**
 * 校验 Skill 目录结构是否符合工程化标准。
 *
 * 用法:
 *   deno run -A scripts/validate-skill-structure.ts <skill_dir>
 *
 * exit 0 = 通过；exit 1 = 失败（错误打印到 stderr）
 */

import { walk } from "https://deno.land/std@0.213.0/fs/walk.ts";
import { extname, join, relative } from "https://deno.land/std@0.213.0/path/mod.ts";

const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;
const RELATIVE_PATH_PREFIX =
  /^(references|templates|examples|scripts|hooks|docs)\//;

interface CheckResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function fail(errors: string[], msg: string): void {
  errors.push(msg);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch {
    return null;
  }
}

function parseYamlName(skillMd: string): string | null {
  const fenceEnd = skillMd.indexOf("---", 3);
  if (fenceEnd === -1) return null;
  const frontmatter = skillMd.slice(0, fenceEnd);
  const match = frontmatter.match(/\nname:\s*["']?([^"'\n]+)["']?\s*(?:\n|$)/);
  return match?.[1]?.trim() ?? null;
}

function countTriggerWords(skillMd: string): number {
  const fenceEnd = skillMd.indexOf("---", 3);
  if (fenceEnd === -1) return 0;
  const frontmatter = skillMd.slice(0, fenceEnd);
  const quoted = frontmatter.match(/「[^」]+」/g);
  return quoted?.length ?? 0;
}

function extractSubfileIndexPaths(skillMd: string): string[] {
  const section = skillMd.match(/## 子文件索引[\s\S]*?(?=\n## |\n---\s*\n## |$)/);
  if (!section) return [];
  const paths: string[] = [];
  const linkRe = /\]\((references|templates|examples|scripts|hooks|docs)\/[^)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(section[0])) !== null) {
    const full = m[0].slice(2, -1); // remove ]( and )
    paths.push(full);
  }
  return paths;
}

async function listSubFiles(skillDir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of walk(skillDir, {
    includeDirs: false,
    skip: [/node_modules/],
  })) {
    const rel = relative(skillDir, entry.path).replaceAll("\\", "/");
    if (rel === "SKILL.md") continue;
    files.push(rel);
  }
  return files.sort();
}

export async function validateSkillStructure(
  skillDir: string,
): Promise<CheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const skillMdPath = join(skillDir, "SKILL.md");
  const schemaPath = join(skillDir, "schema.json");

  if (!(await fileExists(skillMdPath))) {
    fail(errors, "缺少 SKILL.md");
    return { ok: false, errors, warnings };
  }

  const skillMd = await readText(skillMdPath);
  if (!skillMd) {
    fail(errors, "无法读取 SKILL.md");
    return { ok: false, errors, warnings };
  }

  // yaml 头
  if (!skillMd.startsWith("---")) {
    fail(errors, "SKILL.md 第 1 行必须是 ---");
  }
  const secondFence = skillMd.indexOf("---", 3);
  if (secondFence === -1) {
    fail(errors, "SKILL.md 缺少 yaml 结束 ---");
  }

  const name = parseYamlName(skillMd);
  if (!name || !KEBAB_CASE.test(name)) {
    fail(errors, `name 字段必须是 kebab-case，当前: ${name ?? "缺失"}`);
  }

  const triggerCount = countTriggerWords(skillMd);
  if (triggerCount < 5) {
    fail(errors, `触发词数量 ${triggerCount} < 5`);
  }

  // 箭头 Loop：仅检查伪代码块内
  const pseudoBlocks = skillMd.match(/```pseudo[\s\S]*?```/g) ?? [];
  for (const block of pseudoBlocks) {
    if (/\s→\s/.test(block)) {
      fail(errors, "伪代码块中存在自然语言箭头 Loop");
      break;
    }
  }

  // schema.json
  if (!(await fileExists(schemaPath))) {
    fail(errors, "缺少 schema.json");
  } else {
    const schemaText = await readText(schemaPath);
    if (!schemaText) {
      fail(errors, "无法读取 schema.json");
    } else {
      try {
        const schema = JSON.parse(schemaText);
        if (!schema.inputs) fail(errors, "schema.json 缺少 inputs");
        if (!schema.outputs) fail(errors, "schema.json 缺少 outputs");
        if (!schema.security) warnings.push("schema.json 建议包含 security 块");
      } catch {
        fail(errors, "schema.json 不是合法 JSON");
      }
    }
  }

  // .harness（元 Skill 推荐）或 hooks（可选）
  const hasHarness = await fileExists(join(skillDir, ".harness/flow.yaml"));
  const hasPreHook = await fileExists(join(skillDir, "hooks/pre-execution.md"));
  const hasPostHook = await fileExists(join(skillDir, "hooks/post-execution.md"));
  if (!hasHarness && (!hasPreHook || !hasPostHook)) {
    warnings.push("建议包含 .harness/flow.yaml 或 hooks/pre+post（供 Harness 使用，非 AI 指令）");
  }

  // SKILL.md 不应把 validate 命令当作 Agent 义务
  if (/deno run -A.*validate-skill-structure/.test(skillMd)) {
    warnings.push("SKILL.md 含 validate 命令，宜改为「由 Harness/用户执行」一句带过");
  }

  // 自包含 SKILL 可无「子文件索引」节
  const indexed = extractSubfileIndexPaths(skillMd);
  const actual = await listSubFiles(skillDir);
  // 索引应覆盖主要子文件（允许 tests/fixtures 等未全部索引，但差值过大则 warning）
  const indexedSet = new Set(indexed);
  const unindexed = actual.filter((f) =>
    !indexedSet.has(f) && !f.startsWith("tests/fixtures/")
  );
  if (unindexed.length > 3) {
    warnings.push(
      `子文件索引可能不完整，未索引文件示例: ${unindexed.slice(0, 5).join(", ")}`,
    );
  }

  // 相对路径
  const absPathRe = /(?:[A-Za-z]:\\|\.\/|\.\.\/)/;
  if (absPathRe.test(skillMd)) {
    fail(errors, "SKILL.md 含绝对路径或 ./ 引用");
  }

  for (const p of indexed) {
    if (!RELATIVE_PATH_PREFIX.test(p)) {
      fail(errors, `子文件索引路径不合规: ${p}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// CLI
if (import.meta.main) {
  const skillDir = Deno.args[0];
  if (!skillDir) {
    console.error("用法: validate-skill-structure.ts <skill_dir>");
    Deno.exit(1);
  }

  const resolved = skillDir.replaceAll("\\", "/");
  const result = await validateSkillStructure(resolved);

  if (result.warnings.length > 0) {
    console.warn("warnings:");
    for (const w of result.warnings) console.warn(`  - ${w}`);
  }

  if (!result.ok) {
    console.error("errors:");
    for (const e of result.errors) console.error(`  - ${e}`);
    Deno.exit(1);
  }

  console.log("OK: skill structure validation passed");
}
