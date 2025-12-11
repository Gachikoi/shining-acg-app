#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * 安装 Git Hooks
 * 将脚本复制到 .git/hooks 目录
 */

console.log('🔧 Installing Git hooks...\n');

const hooks = [
  {
    name: 'pre-commit',
    script: 'scripts/pre-commit.ts',
  },
  {
    name: 'commit-msg',
    script: 'scripts/commit-msg.ts',
  },
];

for (const hook of hooks) {
  const hookPath = `.git/hooks/${hook.name}`;
  const hookContent = `#!/bin/sh
# Auto-generated Git hook

deno run --allow-read --allow-run --allow-env ${hook.script} "$@"
`;

  try {
    await Deno.writeTextFile(hookPath, hookContent);
    await Deno.chmod(hookPath, 0o755);
    console.log(`✅ Installed ${hook.name} hook`);
  } catch (error) {
    console.error(`❌ Failed to install ${hook.name} hook:`, error.message);
  }
}

console.log('\n✨ Git hooks installed successfully!');
console.log('\nThe following hooks are now active:');
console.log('  • pre-commit: Format and lint code before commit');
console.log('  • commit-msg: Validate commit message format');
