import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { captureGitContext } from "./index";

describe("@spexor/git", () => {
  it("captures branch, commit, and dirty state from a Git repository", async () => {
    const repositoryRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-git-")
    );
    runGit(repositoryRoot, ["init", "-b", "main"]);
    runGit(repositoryRoot, ["config", "user.name", "Spexor Test"]);
    runGit(repositoryRoot, ["config", "user.email", "test@spexor.local"]);
    await fs.writeFile(path.join(repositoryRoot, "README.md"), "# Test\n");
    runGit(repositoryRoot, ["add", "README.md"]);
    runGit(repositoryRoot, ["commit", "-m", "initial"]);

    const clean = await captureGitContext({
      cwd: repositoryRoot,
      now: () => new Date("2026-07-17T00:00:00.000Z")
    });
    const canonicalRepositoryRoot = await fs.realpath(repositoryRoot);

    expect(clean).toMatchObject({
      available: true,
      repositoryRoot: canonicalRepositoryRoot,
      branch: "main",
      dirty: false,
      capturedAt: "2026-07-17T00:00:00.000Z"
    });
    expect(clean.commitSha).toMatch(/^[a-f0-9]{40}$/);

    await fs.writeFile(path.join(repositoryRoot, "README.md"), "# Changed\n");
    await expect(
      captureGitContext({ cwd: repositoryRoot })
    ).resolves.toMatchObject({
      available: true,
      dirty: true
    });
  });

  it("falls back cleanly outside Git repositories", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-no-git-"));

    await expect(
      captureGitContext({
        cwd,
        now: () => new Date("2026-07-17T00:00:00.000Z")
      })
    ).resolves.toEqual({
      available: false,
      capturedAt: "2026-07-17T00:00:00.000Z"
    });
  });
});

function runGit(cwd: string, args: string[]): void {
  execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
}
