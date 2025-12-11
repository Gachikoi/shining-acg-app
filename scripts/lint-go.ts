#!/usr/bin/env -S deno run --allow-run

/**
 * Lint Go 代码
 */

async function lintGo() {
  console.log('🔍 Linting Go code...');

  // 使用 golangci-lint
  const cmd = new Deno.Command('golangci-lint', {
    args: ['run', './...'],
    cwd: 'packages/server',
    stdout: 'inherit',
    stderr: 'inherit',
  });

  try {
    const { code } = await cmd.output();

    if (code === 0) {
      console.log('✅ Go code linted successfully');
    } else {
      console.error('❌ Go linting failed');
      Deno.exit(code);
    }
  } catch (error) {
    console.warn(
      '⚠️  golangci-lint not found. Install with: brew install golangci-lint'
    );
    console.log('⏭️  Skipping Go linting...');
  }
}

if (import.meta.main) {
  await lintGo();
}
