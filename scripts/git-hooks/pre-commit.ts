#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env

/**
 * Pre-commit hook
 * Automatically runs formatting and linting on staged files
 */

import { LintStaged, runCommandAsync } from "./lint-staged.ts";

const lintStaged = new LintStaged();

lintStaged.run(true, async (stagedFiles) => {
  console.log("正在运行预提交检查...\n");

  const results = await Promise.all([
    // 1. Go 项目 (packages/server)
    (async () => {
      const goFiles = stagedFiles.filter(
        (f) => f.startsWith("packages/server/") && f.endsWith(".go"),
      );
      if (goFiles.length === 0) return null;

      const header = `正在格式化 ${goFiles.length} 个 Go 文件...`;
      try {
        const { code, stderr } = await runCommandAsync("gofmt", [
          "-w",
          ...goFiles,
        ]);
        if (code !== 0) {
          return {
            header,
            success: false,
            logs: `${stderr}❌ Go 格式化失败\n`,
          };
        } else {
          return {
            header,
            success: true,
            logs: "✅ Go 格式化通过\n",
          };
        }
      } catch {
        return {
          header,
          success: false,
          logs: "❌ 未找到 go 命令，Go 格式化失败\n",
        };
      }
    })(),

    // 2. iOS 项目 (packages/ios)
    (async () => {
      const swiftFiles = stagedFiles.filter(
        (f) => f.startsWith("packages/ios/") && f.endsWith(".swift"),
      );
      if (swiftFiles.length === 0) return null;

      const header = `正在检查 ${swiftFiles.length} 个 Swift 文件...`;
      try {
        const { code, stderr } = await runCommandAsync("swift", [
          "format",
          "lint",
          "--strict",
          ...swiftFiles,
        ]);
        if (code !== 0) {
          return {
            header,
            success: false,
            logs:
              `${stderr}\n❌ Swift 格式化检查失败：请在格式化后再提交代码（swift format -i --recursive ./）\n`,
          };
        } else {
          return {
            header,
            success: true,
            logs: "✅ Swift 格式化通过\n",
          };
        }
      } catch {
        return {
          header,
          success: false,
          logs: "❌ 未找到 swift format 命令，Swift 格式化检查失败\n",
        };
      }
    })(),

    // 4. Web 项目
    (async () => {
      const webFiles = stagedFiles.filter((f) => f.startsWith("packages/web/"));
      if (webFiles.length === 0) return null;

      const header = `正在检查 ${webFiles.length} 个 Web 文件...`;
      try {
        const { code, stderr } = await runCommandAsync("deno", [
          "task",
          "--cwd=packages/web",
          "lint",
        ]);
        if (code !== 0) {
          return {
            header,
            success: false,
            logs:
              `${stderr}\n❌ Web 文件检查失败：请在代码格式化并修复 eslint 后再提交代码\n`,
          };
        } else {
          return {
            header,
            success: true,
            logs: "✅ Web 文件检查通过\n",
          };
        }
      } catch {
        return {
          header,
          success: false,
          logs: "❌ 未找到 deno，Web 文件检查失败\n",
        };
      }
    })(),

    // 5. 根目录管理文件
    (async () => {
      const scriptsFiles = stagedFiles.filter((f) => f.startsWith("scripts/"));
      if (scriptsFiles.length === 0) return null;

      const header = `正在检查 ${scriptsFiles.length} 个根目录或脚本文件...`;
      try {
        const [fmt, lint] = await Promise.all([
          runCommandAsync("deno", ["fmt", ...scriptsFiles]),
          runCommandAsync("deno", ["lint", "--fix", ...scriptsFiles]),
        ]);

        let logs = "";
        if (fmt.code !== 0) {
          logs += "format：\n";
          logs += fmt.stderr + "\n\n";
        }

        if (lint.code !== 0) {
          logs += "lint：\n";
          logs += lint.stderr + "\n\n";
        }

        let success = true;
        if (fmt.code !== 0 || lint.code !== 0) {
          logs +=
            "❌ 根目录或脚本文件格式化检查 & 代码分析失败：请在 deno task fmt 和 deno task lint 后再提交代码\n";
          success = false;
        } else {
          logs += "✅ 根目录或脚本文件格式化检查 & 代码分析通过\n";
        }

        return { header, success, logs };
      } catch {
        return {
          header,
          success: false,
          logs: "❌ 未找到 deno，根目录或脚本文件检查失败\n",
        };
      }
    })(),
  ]);

  let hasErrors = false;

  for (const result of results) {
    if (!result) continue;
    console.log("----------------------------------------");
    console.log(result.header);
    console.log(result.logs);
    if (!result.success) {
      hasErrors = true;
    }
  }

  if (hasErrors) {
    throw new Error("预提交代码检查未通过");
  }

  console.log("\n✨ 所有预提交检查已通过！");
});
