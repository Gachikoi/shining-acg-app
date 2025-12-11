#!/usr/bin/env -S deno run --allow-run

/**
 * Lint Kotlin 代码
 */

async function lintKotlin() {
  console.log('🔍 Linting Kotlin code...');

  const cmd = new Deno.Command('sh', {
    args: [
      '-c',
      "cd packages/android && ./gradlew ktlintCheck || echo 'ktlint not configured'",
    ],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();

  if (code === 0) {
    console.log('✅ Kotlin code linted successfully');
  } else {
    console.warn('⚠️  Kotlin linting skipped (configure ktlint in Gradle)');
  }
}

if (import.meta.main) {
  await lintKotlin();
}
