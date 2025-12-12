// /**
//  * Pre-commit hook
//  * 在提交前自动运行格式化和 lint 检查 (仅针对 staged 文件)
//  */


// const decoder = new TextDecoder();

// async function getStagedFiles(): Promise<string[]> {
//   const cmd = new Deno.Command('git', {
//     args: ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
//   });
//   const { stdout } = await cmd.output();
//   const output = decoder.decode(stdout).trim();
//   return output ? output.split('\n') : [];
// }

// async function gitAdd(files: string[]) {
//   if (files.length === 0) return;
//   const cmd = new Deno.Command('git', {
//     args: ['add', ...files],
//   });
//   await cmd.output();
// }

// console.log('🔍 Running pre-commit checks on staged files...\n');

// const stagedFiles = await getStagedFiles();

// if (stagedFiles.length === 0) {
//   console.log('✨ No staged files to check.');
//   Deno.exit(0);
// }

// const swiftFiles = stagedFiles.filter((f) => f.endsWith('.swift'));
// const goFiles = stagedFiles.filter((f) => f.endsWith('.go'));
// const kotlinFiles = stagedFiles.filter((f) => f.endsWith('.kt'));
// const webFiles = stagedFiles.filter((f) =>
//   /\.(ts|tsx|js|jsx|json|md)$/.test(f)
// );

// let hasErrors = false;

// // 1. Swift
// if (swiftFiles.length > 0) {
//   console.log(`📝 Processing ${swiftFiles.length} Swift files...`);

//   // Format
//   try {
//     const cmd = new Deno.Command('swiftformat', {
//       args: ['--swiftversion', '5', ...swiftFiles],
//       stdout: 'inherit',
//       stderr: 'inherit',
//     });
//     const { code } = await cmd.output();
//     if (code === 0) {
//       await gitAdd(swiftFiles);
//     } else {
//       console.error('❌ Swift formatting failed');
//       hasErrors = true;
//     }
//   } catch {
//     console.warn('⚠️  swiftformat not found. Skipping...');
//   }

//   // Lint
//   if (!hasErrors) {
//     try {
//       const cmd = new Deno.Command('swiftlint', {
//         args: ['lint', '--strict', ...swiftFiles],
//         stdout: 'inherit',
//         stderr: 'inherit',
//       });
//       const { code } = await cmd.output();
//       if (code !== 0) {
//         console.error('❌ Swift linting failed');
//         hasErrors = true;
//       }
//     } catch {
//       console.warn('⚠️  swiftlint not found. Skipping...');
//     }
//   }
// }

// // 2. Go
// if (goFiles.length > 0) {
//   console.log(`📝 Processing ${goFiles.length} Go files...`);
//   try {
//     const cmd = new Deno.Command('gofmt', {
//       args: ['-w', ...goFiles],
//       stdout: 'inherit',
//       stderr: 'inherit',
//     });
//     const { code } = await cmd.output();
//     if (code === 0) {
//       await gitAdd(goFiles);
//     } else {
//       console.error('❌ Go formatting failed');
//       hasErrors = true;
//     }
//   } catch {
//     console.warn('⚠️  gofmt not found. Skipping...');
//   }
// }

// // 3. Kotlin
// if (kotlinFiles.length > 0) {
//   console.log(`📝 Processing Kotlin files (running full check)...`);
//   const fmtCmd = new Deno.Command('deno', {
//     args: ['run', '--allow-run', 'scripts/git-hooks/format-kotlin.ts'],
//     stdout: 'inherit',
//     stderr: 'inherit',
//   });
//   const { code } = await fmtCmd.output();
//   if (code === 0) {
//     await gitAdd(kotlinFiles);
//   } else {
//     console.error('❌ Kotlin formatting failed');
//     hasErrors = true;
//   }

//   if (!hasErrors) {
//     const lintCmd = new Deno.Command('deno', {
//       args: ['run', '--allow-run', 'scripts/git-hooks/lint-kotlin.ts'],
//       stdout: 'inherit',
//       stderr: 'inherit',
//     });
//     const { code: lintCode } = await lintCmd.output();
//     if (lintCode !== 0) {
//       console.error('❌ Kotlin linting failed');
//       hasErrors = true;
//     }
//   }
// }

// // 4. Web/Deno
// if (webFiles.length > 0) {
//   console.log(`📝 Processing ${webFiles.length} Web/Deno files...`);

//   // Format
//   const fmtCmd = new Deno.Command('deno', {
//     args: ['fmt', ...webFiles],
//     stdout: 'inherit',
//     stderr: 'inherit',
//   });
//   const fmtResult = await fmtCmd.output();
//   if (fmtResult.code === 0) {
//     await gitAdd(webFiles);
//   } else {
//     console.error('❌ Deno formatting failed');
//     hasErrors = true;
//   }

//   // Lint
//   if (!hasErrors) {
//     const lintCmd = new Deno.Command('deno', {
//       args: ['lint', ...webFiles],
//       stdout: 'inherit',
//       stderr: 'inherit',
//     });
//     const lintResult = await lintCmd.output();
//     if (lintResult.code !== 0) {
//       console.error('❌ Deno linting failed');
//       hasErrors = true;
//     }
//   }
// }

// if (hasErrors) {
//   console.error('\n❌ Pre-commit checks failed. Please fix the errors above.');
//   Deno.exit(1);
// }

// console.log('\n✨ All pre-commit checks passed!');
