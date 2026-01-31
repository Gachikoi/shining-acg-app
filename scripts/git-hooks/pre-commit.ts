#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

/**
 * Pre-commit hook
 * Automatically runs formatting and linting on staged files
 */

import { LintStaged, runCommand } from "./lint-staged.ts";

const lintStaged = new LintStaged();

lintStaged.run((stagedFiles) => {
  console.log("正在运行预提交检查...\n");

  let hasErrors = false;

  // 1. Go 项目 (packages/server)
  const goFiles = stagedFiles.filter(
    (f) => f.startsWith("packages/server/") && f.endsWith(".go"),
  );
  if (goFiles.length > 0) {
    console.log("----------------------------------------");
    console.log(`正在格式化 ${goFiles.length} 个 Go 文件...`);
    try {
      const { code, stderr } = runCommand("gofmt", [...goFiles]);
      if (code !== 0) {
        console.error(stderr, "❌ Go 格式化失败\n");
        hasErrors = true;
      } else {
        console.log("✅ Go 格式化通过\n");
      }
    } catch {
      console.error("❌ 未找到 go 命令，Go 格式化失败\n");
      hasErrors = true;
    }
  }

  // 2. iOS 项目 (packages/ios)
  const swiftFiles = stagedFiles.filter(
    (f) => f.startsWith("packages/ios/") && f.endsWith(".swift"),
  );
  if (swiftFiles.length > 0) {
    console.log("----------------------------------------");
    console.log(`正在检查 ${swiftFiles.length} 个 Swift 文件...`);
    try {
      const { code, stderr } = runCommand("swift", [
        "format",
        "lint",
        "--strict",
        ...swiftFiles,
      ]);
      if (code !== 0) {
        console.error(
          stderr,
          "\n❌ Swift 格式化检查失败：请在格式化后再提交代码（swift format -i --recursive ./）\n",
        );
        hasErrors = true;
      } else {
        console.log("✅ Swift 格式化通过\n");
      }
    } catch {
      console.error("❌ 未找到 swift format 命令，Swift 格式化检查失败\n");
      hasErrors = true;
    }
  }

  // // 3. Android 项目 (packages/android)
  // const kotlinFiles = stagedFiles.filter(
  //   (f) =>
  //     f.startsWith("packages/android/") &&
  //     (f.endsWith(".kt") || f.endsWith(".kts")),
  // );
  // if (kotlinFiles.length > 0) {
  //   console.log("----------------------------------------");
  //   console.log(`正在检查 ${kotlinFiles.length} 个 Kotlin 文件...`);
  //   try {
  //     // 使用 ktlint 格式化
  //     const { code, stdout, stderr } = runCommand("ktlint", [...kotlinFiles]);

  //     console.log(stdout);

  //     if (code !== 0) {
  //       console.error(
  //         stderr,
  //         "❌ Kotlin 格式化检查失败：请在格式化后再提交代码（ktlint --format）\n",
  //       );
  //       hasErrors = true;
  //     } else {
  //       console.log("✅ Kotlin 格式化通过\n");
  //     }
  //   } catch {
  //     console.error("❌ 未找到 ktlint 命令，Kotlin 格式化检查失败\n");
  //     hasErrors = true;
  //   }
  // }

  // 4. Web 项目
  const webFiles = stagedFiles.filter((f) => f.startsWith("packages/web/"));
  if (webFiles.length > 0) {
    console.log("----------------------------------------");
    console.log(`正在检查 ${webFiles.length} 个 Web 文件...`);
    try {
      const { code, stderr } = runCommand("deno", [
        "task",
        "--cwd=packages/web",
        "lint",
      ]);
      if (code !== 0) {
        console.error(
          stderr,
          "\n❌ Web 文件检查失败：请在代码格式化并修复 eslint 后再提交代码\n",
        );
        hasErrors = true;
      } else {
        console.log("✅ Web 文件检查通过\n");
      }
    } catch {
      console.error("❌ 未找到 deno，Web 文件检查失败\n");
      hasErrors = true;
    }
  }

  // 5. 根目录管理文件
  const scriptsFiles = stagedFiles.filter(
    (f) => f.startsWith("scripts/"),
  );
  if (scriptsFiles.length > 0) {
    console.log("----------------------------------------");
    console.log(`正在检查 ${scriptsFiles.length} 个根目录或脚本文件...`);
    try {
      const { code: fmtCode, stderr: fmtStderr } = runCommand("deno", [
        "fmt",
        ...scriptsFiles,
      ]);
      const { code: lintCode, stderr: lintStderr } = runCommand("deno", [
        "lint",
        "--fix",
        ...scriptsFiles,
      ]);

      if (fmtCode !== 0) {
        console.log("format：");
        console.error(fmtStderr, "\n");
      }

      if (lintCode !== 0) {
        console.log("lint：");
        console.error(lintStderr, "\n");
      }

      if (fmtCode !== 0 || lintCode !== 0) {
        console.error(
          "❌ 根目录或脚本文件格式化检查 & 代码分析失败：请在 deno task fmt 和 deno task lint 后再提交代码\n",
        );
        hasErrors = true;
      } else {
        console.log("✅ 根目录或脚本文件格式化检查 & 代码分析通过\n");
      }
    } catch {
      console.error("❌ 未找到 deno，根目录或脚本文件检查失败\n");
      hasErrors = true;
    }
  }

  if (hasErrors) {
    throw new Error("预提交代码检查未通过");
  }

  console.log("\n✨ 所有预提交检查已通过！");
});
