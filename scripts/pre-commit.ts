#!/usr/bin/env -S deno run --allow-read --allow-run

/**
 * Pre-commit hook
 * 在提交前自动运行格式化和 lint 检查
 */

console.log('🔍 Running pre-commit checks...\n');

// 1. 格式化所有代码
console.log('📝 Step 1: Formatting code...');
const formatCmd = new Deno.Command('deno', {
  args: ['task', 'format:all'],
  stdout: 'inherit',
  stderr: 'inherit',
});

const formatResult = await formatCmd.output();

if (formatResult.code !== 0) {
  console.error('❌ Formatting failed');
  Deno.exit(1);
}

console.log('✅ Formatting completed\n');

// 2. Lint 所有代码
console.log('🔎 Step 2: Linting code...');
const lintCmd = new Deno.Command('deno', {
  args: ['task', 'lint:all'],
  stdout: 'inherit',
  stderr: 'inherit',
});

const lintResult = await lintCmd.output();

if (lintResult.code !== 0) {
  console.error('❌ Linting failed');
  Deno.exit(1);
}

console.log('✅ Linting completed\n');

console.log('✨ All pre-commit checks passed!');
