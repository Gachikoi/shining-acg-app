#!/usr/bin/env -S deno run --allow-run

/**
 * Lint Swift 代码
 */

async function lintSwift() {
  console.log('🔍 Linting Swift code...');

  // 使用 swiftlint
  const cmd = new Deno.Command('swiftlint', {
    args: ['lint', 'packages/ios'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  try {
    const { code } = await cmd.output();

    if (code === 0) {
      console.log('✅ Swift code linted successfully');
    } else {
      console.error('❌ Swift linting failed');
      Deno.exit(code);
    }
  } catch (error) {
    console.warn(
      '⚠️  swiftlint not found. Install with: brew install swiftlint'
    );
    console.log('⏭️  Skipping Swift linting...');
  }
}

if (import.meta.main) {
  await lintSwift();
}
