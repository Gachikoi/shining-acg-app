#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

/**
 * Pre-commit hook
 * Automatically runs formatting and linting on staged files
 */

import { LintStaged } from "./lint-staged.ts";

const lintStaged = new LintStaged();

lintStaged.run((_stagedFiles) => {
  // console.log('🔍 Running pre-commit checks on staged files...\n');
  // const swiftFiles = stagedFiles.filter((f) => f.endsWith('.swift'));
  // const goFiles = stagedFiles.filter((f) => f.endsWith('.go'));
  // const webFiles = stagedFiles.filter((f) =>
  //   /\.(ts|tsx|js|jsx|json|md|svelte|css|html)$/.test(f)
  // );
  // let hasErrors = false;
  // // 1. Swift
  // if (swiftFiles.length > 0) {
  //   console.log(`📝 Processing ${swiftFiles.length} Swift files...`);
  //   try {
  //     // Check if swiftformat exists
  //     try {
  //       runCommand('swiftformat', ['--version']);
  //       const { code } = runCommand('swiftformat', [
  //         '--swiftversion',
  //         '5',
  //         ...swiftFiles,
  //       ]);
  //       if (code !== 0) {
  //         console.error('❌ Swift formatting failed');
  //         hasErrors = true;
  //       }
  //     } catch {
  //       console.warn('⚠️  swiftformat not found. Skipping...');
  //     }
  //     if (!hasErrors) {
  //       try {
  //         runCommand('swiftlint', ['version']);
  //         const { code } = runCommand('swiftlint', [
  //           'lint',
  //           '--strict',
  //           ...swiftFiles,
  //         ]);
  //         if (code !== 0) {
  //           console.error('❌ Swift linting failed');
  //           hasErrors = true;
  //         }
  //       } catch {
  //         console.warn('⚠️  swiftlint not found. Skipping...');
  //       }
  //     }
  //   } catch (e) {
  //     console.error('❌ Swift checks failed:', e);
  //     hasErrors = true;
  //   }
  // }
  // // 2. Go
  // if (goFiles.length > 0) {
  //   console.log(`📝 Processing ${goFiles.length} Go files...`);
  //   try {
  //     const { code } = runCommand('gofmt', ['-w', ...goFiles]);
  //     if (code !== 0) {
  //       console.error('❌ Go formatting failed');
  //       hasErrors = true;
  //     }
  //   } catch {
  //     console.warn('⚠️  gofmt not found. Skipping...');
  //   }
  // }
  // // 3. Web
  // if (webFiles.length > 0) {
  //   console.log(`📝 Processing ${webFiles.length} Web/Deno files...`);
  //   // Format
  //   const { code: fmtCode, stderr: fmtStderr } = runCommand('deno', [
  //     'fmt',
  //     ...webFiles,
  //   ]);
  //   if (fmtCode !== 0) {
  //     console.error('❌ Deno formatting failed');
  //     console.error(fmtStderr);
  //     hasErrors = true;
  //   }
  //   // Lint
  //   if (!hasErrors) {
  //     const { code: lintCode, stderr: lintStderr } = runCommand('deno', [
  //       'lint',
  //       ...webFiles,
  //     ]);
  //     if (lintCode !== 0) {
  //       console.error('❌ Deno linting failed');
  //       console.error(lintStderr);
  //       hasErrors = true;
  //     }
  //   }
  // }
  // if (hasErrors) {
  //   throw new Error('Pre-commit checks failed');
  // }
  // console.log('\n✨ All pre-commit checks passed!');
});
