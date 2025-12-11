#!/usr/bin/env -S deno run --allow-run

/**
 * 格式化 Kotlin 代码
 */

async function formatKotlin() {
  console.log('🔧 Formatting Kotlin code...');

  // 使用 ktlint 格式化
  const cmd = new Deno.Command('sh', {
    args: [
      '-c',
      "cd packages/android && ./gradlew ktlintFormat || echo 'ktlint not configured'",
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();

  if (code === 0) {
    console.log('✅ Kotlin code formatted successfully');
  } else {
    console.warn('⚠️  Kotlin formatting skipped (configure ktlint in Gradle)');
  }
}

if (import.meta.main) {
  await formatKotlin();
}
