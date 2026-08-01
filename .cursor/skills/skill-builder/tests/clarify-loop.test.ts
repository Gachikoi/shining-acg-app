import { join } from "https://deno.land/std@0.213.0/path/mod.ts";

const SKILL_ROOT = join(import.meta.dirname!, "..");
const PYTHON = "python";

async function runClarifyLoop(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const cmd = new Deno.Command(PYTHON, {
    args: ["scripts/clarify_loop.py", ...args],
    cwd: SKILL_ROOT,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
}

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

Deno.test("clarify_loop create flow reaches exit_to_design after confirm", async () => {
  let r = await runClarifyLoop(["clarify", "init", "--mode", "create"]);
  if (r.code !== 0) throw new Error(r.stderr || r.stdout);

  let state = parseJson(r.stdout);
  const next = state.next_action as Record<string, string>;
  if (next?.type !== "ask_question" || next?.requirement_id !== "skill_name") {
    throw new Error(`expected ask skill_name, got ${JSON.stringify(next)}`);
  }

  const steps: [string, string][] = [
    ["skill_name", "pr-description-builder"],
    ["core_problem", "自动生成符合团队规范的 PR 描述"],
    ["trigger_scenario", "用户说生成 PR 描述或写 PR"],
    ["capabilities", "生成描述、检查 PR 标题格式"],
    ["expected_output", "Markdown 文本"],
    ["references", "没有"],
  ];

  for (const [id, value] of steps) {
    r = await runClarifyLoop(["clarify", "apply", "--id", id, "--value", value]);
    if (r.code !== 0) throw new Error(`${id}: ${r.stderr}`);
    state = parseJson(r.stdout);
    const na = state.next_action as Record<string, string>;
    if (id !== "references" && na?.type !== "ask_question") {
      throw new Error(`after ${id} expected ask_question, got ${na?.type}`);
    }
  }

  if ((state.next_action as Record<string, string>)?.type !== "wait_for_confirmation") {
    throw new Error("expected wait_for_confirmation before confirm");
  }

  r = await runClarifyLoop(["clarify", "confirm"]);
  if (r.code !== 0) throw new Error(r.stderr);
  state = parseJson(r.stdout);

  if (state.can_exit !== true) throw new Error("expected can_exit true");
  if ((state.next_action as Record<string, string>)?.type !== "exit_to_design") {
    throw new Error("expected exit_to_design");
  }
  if (state.user_confirmed !== true) throw new Error("expected user_confirmed true");

  const record = state.clarify_record as Record<string, string>;
  if (record.skill_name !== "pr-description-builder") {
    throw new Error("clarify_record.skill_name mismatch");
  }
});

Deno.test("clarify_loop rejects invalid kebab_case skill_name", async () => {
  await runClarifyLoop(["clarify", "init", "--mode", "create"]);
  const r = await runClarifyLoop([
    "clarify",
    "apply",
    "--id",
    "skill_name",
    "--value",
    "Bad_Name",
  ]);
  if (r.code === 0) throw new Error("expected validation failure");
  if (!r.stderr.includes("kebab-case")) {
    throw new Error(`expected kebab-case error, got: ${r.stderr}`);
  }
});

Deno.test("session reset clears prior clarify progress and idle design/build", async () => {
  await runClarifyLoop(["clarify", "init", "--mode", "create"]);
  let r = await runClarifyLoop(["clarify", "apply", "--id", "skill_name", "--value", "old-skill"]);
  if (r.code !== 0) throw new Error(r.stderr);

  r = await runClarifyLoop(["session", "reset", "--mode", "create"]);
  if (r.code !== 0) throw new Error(r.stderr);

  const payload = parseJson(r.stdout);
  if (payload.reset !== true) throw new Error("expected reset: true");

  const clarify = payload.clarify as Record<string, unknown>;
  const record = clarify.clarify_record as Record<string, unknown>;
  if (record.skill_name != null) {
    throw new Error("clarify_record.skill_name should be null after reset");
  }

  const design = payload.design as Record<string, unknown>;
  const designRecord = design.design_record as Record<string, unknown>;
  if (designRecord.design_doc) {
    throw new Error("design_doc should be empty after reset");
  }

  const build = payload.build as Record<string, unknown>;
  const buildRecord = build.build_record as Record<string, unknown>;
  const done = buildRecord.files_done as string[];
  if (done?.length > 0) {
    throw new Error("files_done should be empty after reset");
  }
});
