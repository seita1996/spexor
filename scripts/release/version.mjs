import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const VERSION_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

export async function main(argv = process.argv.slice(2), options = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const version = await resolveReleaseVersion(argv, options);
  const updated = await syncWorkspaceVersions({ cwd, version });

  process.stdout.write(
    `Synced ${version} across ${updated.length} package.json files.\n`
  );
  for (const filePath of updated) {
    process.stdout.write(`${path.relative(cwd, filePath)}\n`);
  }
}

export async function resolveReleaseVersion(argv, options = {}) {
  const args = [...argv];
  const fromTag = args.includes("--from-tag");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (fromTag && positional.length > 0) {
    throw new Error("Pass either an explicit version or --from-tag, not both.");
  }

  if (!fromTag && positional.length !== 1) {
    throw new Error(
      "Usage: pnpm release:version <version> or pnpm release:version --from-tag"
    );
  }

  const rawVersion = fromTag ? await loadExactGitTag(options) : positional[0];

  return normalizeVersion(rawVersion ?? "");
}

export function normalizeVersion(input) {
  const value = input.trim();
  const match = VERSION_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Invalid release version: ${input}`);
  }

  return value.startsWith("v") ? value.slice(1) : value;
}

export async function syncWorkspaceVersions({ cwd, version }) {
  const packageJsonPaths = await findWorkspacePackageJsonPaths(cwd);
  const updated = [];

  for (const filePath of packageJsonPaths) {
    const source = await fs.readFile(filePath, "utf8");
    const manifest = JSON.parse(source);
    manifest.version = version;
    await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
    updated.push(filePath);
  }

  return updated;
}

export async function findWorkspacePackageJsonPaths(cwd) {
  const roots = ["apps", "packages"];
  const paths = [path.join(cwd, "package.json")];

  for (const root of roots) {
    const baseDir = path.join(cwd, root);
    let entries = [];
    try {
      entries = await fs.readdir(baseDir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageJsonPath = path.join(baseDir, entry.name, "package.json");
      try {
        await fs.access(packageJsonPath);
        paths.push(packageJsonPath);
      } catch (error) {
        if (!(error && error.code === "ENOENT")) {
          throw error;
        }
      }
    }
  }

  return paths.sort();
}

async function loadExactGitTag(options = {}) {
  if (typeof options.loadTag === "function") {
    const tag = await options.loadTag();
    return tag;
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const envTag =
    process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : null;
  if (envTag) {
    return envTag;
  }

  const result = await execFileAsync(
    "git",
    ["describe", "--tags", "--exact-match"],
    { cwd }
  );
  return result.stdout.trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown release version error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
