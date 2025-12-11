#!/usr/bin/env -S deno run --allow-run

/**
 * 格式化 Go 代码
 */

async function formatGo() {
  console.log('🔧 Formatting Go code...');

  const cmd = new Deno.Command('gofmt', {
    args: ['-w', 'packages/server'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();

  if (code === 0) {
    console.log('✅ Go code formatted successfully');
  } else {
    console.error('❌ Go formatting failed');
    Deno.exit(code);
  }
}

if (import.meta.main) {
  await formatGo();
}
