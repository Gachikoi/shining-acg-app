import { validateSkillStructure } from "../scripts/validate-skill-structure.ts";
import { join } from "https://deno.land/std@0.213.0/path/mod.ts";

const FIXTURES = join(import.meta.dirname!, "fixtures");

Deno.test("minimal-valid-skill passes validation", async () => {
  const dir = join(FIXTURES, "minimal-valid-skill");
  const result = await validateSkillStructure(dir);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
});

Deno.test("invalid-missing-schema fails validation", async () => {
  const dir = join(FIXTURES, "invalid-missing-schema");
  const result = await validateSkillStructure(dir);
  if (result.ok) {
    throw new Error("expected validation to fail");
  }
  if (!result.errors.some((e: string) => e.includes("schema.json"))) {
    throw new Error(`expected schema error, got: ${result.errors}`);
  }
});

Deno.test("skill-builder itself passes validation", async () => {
  const dir = join(import.meta.dirname!, "..");
  const result = await validateSkillStructure(dir);
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }
});
