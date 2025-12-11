#!/usr/bin/env -S deno run --allow-read --allow-env

/**
 * Commitlint - 验证 commit message 格式
 *
 * 支持的类型：
 * - feat: 新功能
 * - fix: 修复 bug
 * - docs: 文档更新
 * - style: 代码格式（不影响代码运行）
 * - refactor: 重构
 * - perf: 性能优化
 * - test: 测试相关
 * - build: 构建系统或外部依赖
 * - ci: CI/CD 配置
 * - chore: 其他修改
 * - revert: 回退
 */

const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

const COMMIT_PATTERN =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,100}/;

function validateCommitMessage(message: string): {
  valid: boolean;
  error?: string;
} {
  // 移除空白字符
  const trimmedMessage = message.trim();

  if (trimmedMessage.length === 0) {
    return {
      valid: false,
      error: 'Commit message cannot be empty',
    };
  }

  // 检查格式
  if (!COMMIT_PATTERN.test(trimmedMessage)) {
    return {
      valid: false,
      error: `Commit message format is invalid.

Expected format: <type>[optional scope]: <description>

Example:
  feat: add user authentication
  fix(api): resolve cors issue
  docs: update README

Valid types: ${COMMIT_TYPES.join(', ')}`,
    };
  }

  // 检查首字母小写
  const descriptionPart = trimmedMessage.split(': ')[1];
  if (descriptionPart && /^[A-Z]/.test(descriptionPart)) {
    return {
      valid: false,
      error: 'Commit message description should start with lowercase letter',
    };
  }

  return { valid: true };
}

async function main() {
  // 从参数或 stdin 读取 commit message
  const commitMsgFile = Deno.args[0];

  let commitMessage: string;

  if (commitMsgFile) {
    // 从文件读取
    commitMessage = await Deno.readTextFile(commitMsgFile);
  } else {
    // 从 stdin 读取
    const decoder = new TextDecoder();
    const buf = new Uint8Array(1024);
    const n = await Deno.stdin.read(buf);
    commitMessage = decoder.decode(buf.subarray(0, n || 0));
  }

  // 验证
  const result = validateCommitMessage(commitMessage);

  if (!result.valid) {
    console.error('❌ Commit message validation failed:\n');
    console.error(result.error);
    console.error('\nYour commit message:');
    console.error(`  ${commitMessage.trim()}`);
    Deno.exit(1);
  }

  console.log('✅ Commit message is valid');
}

if (import.meta.main) {
  await main();
}

export { validateCommitMessage };
