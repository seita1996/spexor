import { readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
let failed = false;

function fail(message) {
  console.error(`Harness check failed: ${message}`);
  failed = true;
}

async function read(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

function requireIncludes(content, pattern, filePath, hint) {
  if (!content.includes(pattern)) {
    fail(`${filePath} is missing "${pattern}". ${hint}`);
  }
}

async function checkCodexConfig() {
  const configPath = ".codex/config.toml";
  const config = await read(configPath);
  requireIncludes(
    config,
    'notify = ["python3", "hooks/agent_turn_complete.py"]',
    configPath,
    "Project-scoped notify must point to the turn-complete hook."
  );
}

async function checkAgents() {
  const filePath = "AGENTS.md";
  const content = await read(filePath);
  const lineCount = content.trimEnd().split("\n").length;

  if (lineCount > 80) {
    fail(`${filePath} has ${lineCount} lines. Keep it pointer-sized.`);
  }

  requireIncludes(
    content,
    "`pnpm harness:check`",
    filePath,
    "Expose the harness entrypoint to Codex."
  );
  requireIncludes(
    content,
    "`pnpm codex:turn-check`",
    filePath,
    "Document the turn-boundary guardrail."
  );
}

async function checkReadme() {
  const filePath = "README.md";
  const content = await read(filePath);
  requireIncludes(
    content,
    "`pnpm harness:check`",
    filePath,
    "README should expose the deterministic harness command."
  );
}

async function checkLefthook() {
  const filePath = "lefthook.yml";
  const content = await read(filePath);
  requireIncludes(
    content,
    "run: pnpm harness:check",
    filePath,
    "pre-commit must run harness:check first."
  );
  requireIncludes(
    content,
    "run: pnpm codex:turn-check staged",
    filePath,
    "pre-commit must run the staged turn check."
  );
}

async function checkAdr() {
  const filePath = "docs/adr/0002-codex-turn-boundary-guardrails.md";
  const content = await read(filePath);
  requireIncludes(
    content,
    "## Context",
    filePath,
    "ADR structure is required."
  );
  requireIncludes(
    content,
    "## Decision",
    filePath,
    "ADR structure is required."
  );
  requireIncludes(
    content,
    "## Consequences",
    filePath,
    "ADR structure is required."
  );
}

await checkCodexConfig();
await checkAgents();
await checkReadme();
await checkLefthook();
await checkAdr();

if (failed) {
  process.exit(1);
}
