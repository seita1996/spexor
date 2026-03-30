import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const mode = process.argv[2] ?? "worktree";
const rootDir = process.cwd();

const lintExtensions = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts"
]);

const formatExtensions = new Set([
  ...lintExtensions,
  ".json",
  ".jsonc",
  ".md",
  ".css",
  ".scss",
  ".yml",
  ".yaml",
  ".toml"
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runBiomeFormat(args) {
  const result = spawnSync(
    "pnpm",
    ["exec", "biome", "format", "--write", ...args],
    {
      cwd: rootDir,
      encoding: "utf8"
    }
  );

  if (result.status === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return;
  }

  const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ignoredOnly =
    combinedOutput.includes(
      "No files were processed in the specified paths."
    ) && combinedOutput.includes("provided but ignored");

  if (ignoredOnly) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    console.log("[codex:turn-check] Skipping Biome-ignored files.");
    return;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status ?? 1);
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    if (stderr) {
      console.error(stderr);
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout;
}

function normalizeFiles(output) {
  return output
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
}

function listGitFiles(args) {
  return normalizeFiles(runCapture("git", args));
}

function getPartiallyStagedFiles() {
  if (mode !== "staged") {
    return new Set();
  }

  const stagedFiles = new Set(
    listGitFiles(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])
  );
  const unstagedFiles = listGitFiles([
    "diff",
    "--name-only",
    "--diff-filter=ACMR"
  ]).filter((file) => stagedFiles.has(file));

  return new Set(unstagedFiles);
}

function listCandidateFiles() {
  if (mode === "staged") {
    return listGitFiles([
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMR"
    ]);
  }

  if (mode !== "worktree") {
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
  }

  return [
    ...listGitFiles(["diff", "--name-only", "--diff-filter=ACMR"]),
    ...listGitFiles(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]),
    ...listGitFiles(["ls-files", "--others", "--exclude-standard"])
  ];
}

async function uniqueExistingFiles(files) {
  const seen = new Set();
  const existing = [];

  for (const file of files.map((value) => value.trim()).filter(Boolean)) {
    if (seen.has(file)) {
      continue;
    }

    seen.add(file);

    try {
      await access(path.join(rootDir, file));
      existing.push(file);
    } catch {
      // Ignore deleted or not-yet-created files.
    }
  }

  return existing;
}

const partiallyStagedFiles = getPartiallyStagedFiles();
if (partiallyStagedFiles.size > 0) {
  console.error(
    `[codex:turn-check] Partially staged files are not supported: ${Array.from(partiallyStagedFiles).join(", ")}`
  );
  process.exit(1);
}

const files = await uniqueExistingFiles(listCandidateFiles());
const lintFiles = files.filter((file) =>
  lintExtensions.has(path.extname(file))
);
const formatFiles = files.filter((file) =>
  formatExtensions.has(path.extname(file))
);

if (lintFiles.length === 0 && formatFiles.length === 0) {
  console.log(`[codex:turn-check] No eligible files for mode=${mode}.`);
  process.exit(0);
}

if (lintFiles.length > 0) {
  console.log(`[codex:turn-check] Oxlint: ${lintFiles.join(", ")}`);
  run("pnpm", ["exec", "oxlint", "--fix", ...lintFiles]);
}

if (formatFiles.length > 0) {
  console.log(`[codex:turn-check] Biome format: ${formatFiles.join(", ")}`);
  runBiomeFormat(formatFiles);
}

if (mode === "staged") {
  run("git", ["add", "--", ...files]);
}
