const decoder = new TextDecoder();

export function runCommand(
  cmd: string,
  args: string[],
): { stdout: string; stderr: string; code: number } {
  const command = new Deno.Command(cmd, {
    args: args,
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

export class LintStaged {
  private stashed = false;

  getStagedFiles(): string[] {
    const { stdout } = runCommand("git", [
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACM",
    ]);
    return stdout ? stdout.split("\n") : [];
  }

  hasUnstagedChanges(): boolean {
    const { stdout: modified } = runCommand("git", ["diff", "--name-only"]);
    const { stdout: untracked } = runCommand("git", [
      "ls-files",
      "--others",
      "--exclude-standard",
    ]);
    return !!modified || !!untracked;
  }

  stashBackup() {
    console.log("📦 Stash unstaged 文件...");
    // -k (--keep-index): 不 stash 索引内容（即 staged changes）
    // -u (--include-untracked): stash 包括未跟踪的文件
    const { code, stdout, stderr } = runCommand("git", [
      "stash",
      "push",
      "-k",
      "-u",
      "-m",
      "lint-staged-backup",
    ]);

    if (code !== 0) {
      throw new Error(`Stash 失败: ${stderr}`);
    }

    if (stdout.includes("No local changes to save")) {
      this.stashed = false;
    } else {
      this.stashed = true;
    }
  }

  restoreBackup() {
    if (!this.stashed) return;
    console.log("♻️ 恢复 stashed 文件...");
    const { code, stderr } = runCommand("git", ["stash", "pop"]);
    if (code !== 0) {
      console.error(`⚠️ 恢复 stashed 文件失败: ${stderr}`);
      console.error("你也许需要手动解决冲突");
    } else {
      this.stashed = false;
    }
  }

  run(task: (files: string[]) => void) {
    const stagedFiles = this.getStagedFiles();
    if (stagedFiles.length === 0) {
      console.log("✨ No staged files to check.");
      return;
    }

    const hasUnstaged = this.hasUnstagedChanges();

    if (hasUnstaged) {
      this.stashBackup();
    }

    // 后续开始对 repo 中的文件进行实际操作，比较危险，要用 try 确保代码抛出错误后的系统健壮性
    try {
      task(stagedFiles);

      // 将修改后的 stagedFiles 重新放到索引中
      if (stagedFiles.length > 0) {
        runCommand("git", ["add", ...stagedFiles]);
      }
    } catch (e) {
      console.error("❌ lint-staged 任务失败");
      // 如果修改流程失败，重置工作目录到索引状态。即将工作区做的修改撤回，回到那些已 staged 的内容
      runCommand("git", ["restore", "-W", "."]);

      throw e;
    } finally {
      if (hasUnstaged) {
        this.restoreBackup();
      }
    }
  }
}
