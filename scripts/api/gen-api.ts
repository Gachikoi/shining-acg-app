import { createClient } from "@hey-api/openapi-ts";
import { dirname, fromFileUrl, resolve } from "@std/path";
import { runCommand } from "../utils.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));
const workspaceRoot = resolve(__dirname, "../../");
const protoDir = resolve(workspaceRoot, "packages/server/proto");
const webDir = resolve(workspaceRoot, "packages/web");
const swaggerFile = resolve(webDir, "swagger.swagger.json");
const outputDir = resolve(webDir, "src/lib/api");

console.log("生成 API 客户端...");
console.log(`Proto 目录: ${protoDir}`);

// 1. 用 buf 生成 Swagger JSON
console.log("运行 buf generate...");
const bufResult = runCommand("buf", ["generate"], protoDir);

if (bufResult.code !== 0) {
  console.error("生成 swagger.json 失败：", bufResult.stderr, bufResult.stdout);
  Deno.exit(1);
}

// 1.5. 移除 v1/v2 等文件前缀
console.log("处理 Swagger JSON...");

const processResult = runCommand(
  "deno",
  ["run", "-A", resolve(__dirname, "process-swagger.ts")],
  __dirname,
);
if (processResult.code !== 0) {
  console.error("处理 Swagger JSON 失败");
  Deno.exit(processResult.code);
}

// 2. 生成 TypeScript Client
console.log("从 Swagger JSON 生成 TypeScript 客户端...");

try {
  await createClient({
    input: swaggerFile,
    output: outputDir,
    plugins: [
      {
        name: "@hey-api/client-axios",
        runtimeConfigPath: resolve(webDir, "src/hey-api.ts"),
      },
    ],
  });
  console.log(`TypeScript 客户端已生成于 ${outputDir}`);
} catch (error) {
  console.error("生成 API 客户端时出错:", error);
  Deno.exit(1);
}
