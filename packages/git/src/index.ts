import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitContext } from "@spexor/domain";

const execFileAsync = promisify(execFile);

export interface CaptureGitContextOptions {
  cwd: string;
  now?: (() => Date) | undefined;
}

export async function captureGitContext(
  options: CaptureGitContextOptions
): Promise<GitContext> {
  const capturedAt = (options.now ?? (() => new Date()))().toISOString();
  const repositoryRoot = await runGitOptional(options.cwd, [
    "rev-parse",
    "--show-toplevel"
  ]);

  if (!repositoryRoot) {
    return { available: false, capturedAt };
  }

  const [rawBranch, commitSha, status] = await Promise.all([
    runGitOptional(repositoryRoot, ["rev-parse", "--abbrev-ref", "HEAD"]),
    runGitOptional(repositoryRoot, ["rev-parse", "HEAD"]),
    runGitOptional(repositoryRoot, ["status", "--porcelain"])
  ]);
  const branch = rawBranch && rawBranch !== "HEAD" ? rawBranch : undefined;

  return {
    available: true,
    repositoryRoot,
    ...(branch ? { branch } : {}),
    ...(commitSha ? { commitSha } : {}),
    ...(status === undefined ? {} : { dirty: status.length > 0 }),
    capturedAt
  };
}

async function runGitOptional(
  cwd: string,
  args: readonly string[]
): Promise<string | undefined> {
  try {
    const result = await execFileAsync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    return String(result.stdout).trim();
  } catch {
    return undefined;
  }
}
