import { dirname, fromFileUrl, resolve } from "@std/path";

const __dirname = dirname(fromFileUrl(import.meta.url));
const workspaceRoot = resolve(__dirname, "../../");
const webDir = resolve(workspaceRoot, "packages/web");
const swaggerFile = resolve(webDir, "swagger.swagger.json");

console.log(`正在处理 Swagger 文件: ${swaggerFile}`);

try {
  const content = await Deno.readTextFile(swaggerFile);
  const swagger = JSON.parse(content);

  // 1. 重命名定义
  // deno-lint-ignore no-explicit-any
  const newDefinitions: Record<string, any> = {};
  if (swagger.definitions) {
    for (const [key, value] of Object.entries(swagger.definitions)) {
      // 如果看起来像是版本前缀后跟 PascalCase 名称，则删除 v1, v1alpha1 等前缀
      // 例如 v1Post -> Post, v1alpha1User -> User
      // 但保留仅以 v 开头的键（如果在 proto 中遵循样式指南，这种情况不太可能发生）
      const newKey = key.replace(/^v\d+(?:alpha\d+|beta\d+)?/, "");

      // 如果键变为空或以小写字母开头（对于消息类型来说是意外情况），是否保留原始键？
      // Proto 消息是 PascalCase。如果我们有 v1post（不太可能），它会变成 post。
      // 让我们假设标准的 proto 命名。

      if (newKey && newKey !== key) {
        // 检查冲突
        if (newDefinitions[newKey]) {
          console.warn(
            `检测到冲突: ${key} -> ${newKey}。为安全起见保留原始值。`,
          );
          newDefinitions[key] = value;
        } else {
          newDefinitions[newKey] = value;
        }
      } else {
        newDefinitions[key] = value;
      }
    }
    swagger.definitions = newDefinitions;
  }

  // 2. 更新整个文件中的引用
  // 我们可以转换为字符串并替换所有 "$ref": "#/definitions/v1..."
  // 这比深度遍历更安全。
  let jsonString = JSON.stringify(swagger, null, 2);

  // 匹配我们重命名的定义的引用的正则表达式
  // 匹配 "#/definitions/v1..." 并替换为 "#/definitions/..."
  // 该逻辑必须与上面的重命名逻辑匹配。

  jsonString = jsonString.replace(
    /"#\/definitions\/v\d+(?:alpha\d+|beta\d+)?([A-Z][a-zA-Z0-9_]*)"/g,
    '"#/definitions/$1"',
  );

  await Deno.writeTextFile(swaggerFile, jsonString);
  console.log("Swagger 文件处理成功。");
} catch (error) {
  console.error("处理 Swagger 文件时出错:", error);
  Deno.exit(1);
}
