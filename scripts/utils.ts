const decoder = new TextDecoder();

export function runCommand(
  cmd: string,
  args: string[],
  cwd?: string, // 添加可选的 cwd 参数
): { stdout: string; stderr: string; code: number } {
  const command = new Deno.Command(cmd, {
    args: args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = command.outputSync();
  return {
    code,
    stdout: decoder.decode(stdout).trim(),
    stderr: decoder.decode(stderr).trim(),
  };
}

export async function runCommandAsync(
  cmd: string,
  args: string[],
  cwd?: string, // 添加可选的 cwd 参数
): Promise<{ stdout: string; stderr: string; code: number }> {
  const command = new Deno.Command(cmd, {
    args: args,
    cwd: cwd, // 命令工作目录
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  return {
    code,
    stdout: decoder.decode(stdout).trim(),
    stderr: decoder.decode(stderr).trim(),
  };
}
