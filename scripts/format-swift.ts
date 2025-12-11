#!/usr/bin/env -S deno run --allow-run

/**
 * 格式化 Swift 代码
 */

async function formatSwift() {
  console.log('🔧 Formatting Swift code...');

  // 使用 swiftformat 格式化
  const cmd = new Deno.Command('swiftformat', {
    args: ['packages/ios', '--swiftversion', '5'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  try {
    const { code } = await cmd.output();

    if (code === 0) {
      console.log('✅ Swift code formatted successfully');
    } else {
      console.error('❌ Swift formatting failed');
      Deno.exit(code);
    }
  } catch (error) {
    console.warn(
      '⚠️  swiftformat not found. Install with: brew install swiftformat'
    );
    console.log('⏭️  Skipping Swift formatting...');
  }
}

if (import.meta.main) {
  await formatSwift();
}
