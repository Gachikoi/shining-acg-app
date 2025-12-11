#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Commit-msg hook
 * 验证 commit message 格式
 */

import { validateCommitMessage } from './commitlint.ts';

const commitMsgFile = Deno.args[0];

if (!commitMsgFile) {
  console.error('❌ No commit message file provided');
  Deno.exit(1);
}

const commitMessage = await Deno.readTextFile(commitMsgFile);

const result = validateCommitMessage(commitMessage);

if (!result.valid) {
  console.error('❌ Commit message validation failed:\n');
  console.error(result.error);
  console.error('\nYour commit message:');
  console.error(`  ${commitMessage.trim()}`);
  console.error('\nSee docs/COMMIT_CONVENTION.md for more information.');
  Deno.exit(1);
}

console.log('✅ Commit message is valid');
