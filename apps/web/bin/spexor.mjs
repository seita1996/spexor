#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSpecFile,
  deployAwsHub,
  deployCloudflareHub,
  exportResults,
  getProjectStatus,
  initHub,
  initProject,
  initializeConfig,
  linkSharedResults,
  printHelp,
  runDoctor,
  runScan,
  setupProject
} from "./cli-lib.mjs";

const require = createRequire(import.meta.url);
const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(binDir, "..");
const args = process.argv.slice(2);
const command = args[0] ?? "dev";
const projectRoot = process.cwd();
const env = {
  ...process.env,
  SPEXOR_PROJECT_ROOT: projectRoot
};

await main();

async function main() {
  try {
    switch (command) {
      case "dev":
        runDev();
        return;
      case "api":
        runSingleProcess([
          "--import",
          "tsx",
          path.join(packageRoot, "server/index.ts")
        ]);
        return;
      case "init":
        await handleInitCommand(args.slice(1));
        return;
      case "setup":
        await handleSetupCommand();
        return;
      case "doctor":
        await handleDoctorCommand();
        return;
      case "config":
        await handleConfigCommand(args.slice(1));
        return;
      case "spec":
        await handleSpecCommand(args.slice(1));
        return;
      case "scan":
        await handleScanCommand();
        return;
      case "status":
        await handleStatusCommand();
        return;
      case "export":
        await handleExportCommand(args.slice(1));
        return;
      case "hub":
        await handleHubCommand(args.slice(1));
        return;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        return;
      default:
        throw new Error(`unknown command: ${command}`);
    }
  } catch (error) {
    console.error(
      `[spexor] ${error instanceof Error ? error.message : "Command failed"}`
    );
    process.exit(1);
  }
}

async function handleInitCommand(commandArgs) {
  const parsed = parseArgs(commandArgs);
  const result = await initProject({
    projectRoot,
    includeStarter:
      !parsed.flags.has("--no-starter") && !parsed.flags.has("--no-example")
  });

  printCreated(
    result.created,
    "project initialized",
    "project already initialized"
  );
}

async function handleSetupCommand() {
  const result = await setupProject({ projectRoot });
  printCreated(
    result.created,
    "project initialized",
    "project already initialized"
  );
}

async function handleDoctorCommand() {
  const result = await runDoctor({ projectRoot });
  for (const check of result.checks) {
    console.log(`[${check.status}] ${check.id}: ${check.message}`);
  }
}

async function handleConfigCommand(commandArgs) {
  const action = commandArgs[0];
  if (action !== "init") {
    printHelp();
    process.exit(1);
  }

  const parsed = parseArgs(commandArgs.slice(1));
  const result = await initializeConfig({
    projectRoot,
    specDir: parsed.values["--spec-dir"],
    dbPath: parsed.values["--db-path"],
    evidenceDir: parsed.values["--evidence-dir"],
    autoScan: readBooleanOption(parsed, "--auto-scan", true),
    force: parsed.flags.has("--force"),
    sharedResults: parsed.values["--shared-results-base-url"]
      ? {
          baseUrl: parsed.values["--shared-results-base-url"],
          projectId: parsed.values["--shared-results-project-id"]
        }
      : undefined
  });

  console.log(
    result.changed
      ? `[spexor] wrote ${path.relative(projectRoot, result.configPath)}`
      : "[spexor] config already exists"
  );
}

async function handleSpecCommand(commandArgs) {
  if (commandArgs[0] !== "new") {
    printHelp();
    process.exit(1);
  }

  const parsed = parseArgs(commandArgs.slice(1));
  const title = parsed.positionals[0];

  if (!title) {
    throw new Error("spec new requires a title");
  }

  const result = await createSpecFile({
    projectRoot,
    title,
    filePath: parsed.values["--file"],
    scenarioTitle: parsed.values["--scenario"],
    priority: parsed.values["--priority"],
    owner: parsed.values["--owner"],
    tags: parsed.multi["--tag"] ?? [],
    browsers: parsed.multi["--browser"] ?? [],
    platforms: parsed.multi["--platform"] ?? [],
    related: parsed.multi["--related"] ?? [],
    force: parsed.flags.has("--force")
  });

  console.log(`[spexor] created ${result.relativePath}`);
}

async function handleScanCommand() {
  const result = await runScan({ projectRoot });
  console.log(
    `[spexor] scanned ${result.processedCount} files (${result.featureCount} features)`
  );
}

async function handleStatusCommand() {
  const result = await getProjectStatus({ projectRoot });
  console.log(`features: ${result.featureCount}`);
  console.log(`scenarios: ${result.scenarioCount}`);
  console.log(`issues: ${result.issueCount}`);
  console.log(
    `parse health: ok=${result.parseHealth.ok} warning=${result.parseHealth.warning} error=${result.parseHealth.error}`
  );
  console.log(`recorded runs: ${result.recordedRunCount}`);
  console.log(
    `shared results: ${
      result.sharedResultsEnabled
        ? `enabled (${result.sharedResultsProjectId})`
        : "disabled"
    }`
  );
}

async function handleExportCommand(commandArgs) {
  if (commandArgs[0] !== "results") {
    printHelp();
    process.exit(1);
  }

  const parsed = parseArgs(commandArgs.slice(1));
  const result = await exportResults({
    projectRoot,
    outputPath: parsed.values["--out"],
    stdout: parsed.flags.has("--stdout")
  });

  if (parsed.flags.has("--stdout")) {
    process.stdout.write(result.ndjson);
    return;
  }

  console.log(
    `[spexor] exported ${result.itemCount} results to ${path.relative(projectRoot, result.outputPath)}`
  );
}

async function handleHubCommand(subcommandArgs) {
  const action = subcommandArgs[0];
  const provider = subcommandArgs[1];

  if (action === "link") {
    const parsed = parseArgs(subcommandArgs.slice(1));
    const baseUrl = parsed.values["--base-url"] ?? parsed.positionals[0];
    const projectId = parsed.values["--project-id"] ?? parsed.positionals[1];
    const result = await linkSharedResults({
      projectRoot,
      baseUrl,
      projectId
    });
    console.log(
      result.changed
        ? `[spexor] updated ${path.relative(projectRoot, result.configPath)}`
        : "[spexor] shared results already configured"
    );
    return;
  }

  if (!provider || !["init", "deploy"].includes(action)) {
    printHelp();
    process.exit(1);
  }

  switch (provider) {
    case "cloudflare":
      if (action === "init") {
        const result = await initHub({ projectRoot, provider });
        console.log(
          `[spexor] scaffolded ${path.relative(projectRoot, result.hubDir)}`
        );
        return;
      }
      await deployCloudflareHub({ projectRoot });
      return;
    case "aws":
      if (action === "init") {
        const result = await initHub({ projectRoot, provider });
        console.log(
          `[spexor] scaffolded ${path.relative(projectRoot, result.hubDir)}`
        );
        return;
      }
      await deployAwsHub({ projectRoot });
      return;
    default:
      throw new Error(`unknown hub provider: ${provider}`);
  }
}

function runDev() {
  const viteCli = require.resolve("vite/bin/vite.js");
  const serverEntry = path.join(packageRoot, "server/index.ts");
  const viteConfig = path.join(packageRoot, "vite.config.ts");

  const children = [
    spawn(process.execPath, ["--import", "tsx", serverEntry], {
      cwd: packageRoot,
      env,
      stdio: "inherit"
    }),
    spawn(
      process.execPath,
      [viteCli, "--config", viteConfig, "--host", "127.0.0.1"],
      {
        cwd: packageRoot,
        env,
        stdio: "inherit"
      }
    )
  ];

  const shutdown = (exitCode = 0) => {
    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
    process.exit(exitCode);
  };

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(0));
  }

  for (const child of children) {
    child.on("exit", (code) => {
      if (code && code !== 0) {
        shutdown(code);
      }
    });
  }
}

function runSingleProcess(args) {
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    env,
    stdio: "inherit"
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function printCreated(created, successMessage, emptyMessage) {
  if (created.length === 0) {
    console.log(`[spexor] ${emptyMessage}`);
    return;
  }

  console.log(`[spexor] ${successMessage}`);
  for (const filePath of created) {
    console.log(`  - ${filePath}`);
  }
}

function parseArgs(commandArgs) {
  const positionals = [];
  const values = {};
  const multi = {};
  const flags = new Set();

  for (let index = 0; index < commandArgs.length; index += 1) {
    const current = commandArgs[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    flags.add(current);

    if (current.startsWith("--no-")) {
      values[`--${current.slice(5)}`] = false;
      continue;
    }

    const next = commandArgs[index + 1];
    if (!next || next.startsWith("--")) {
      values[current] = true;
      continue;
    }

    index += 1;
    if (multi[current]) {
      multi[current].push(next);
    } else if (values[current] && values[current] !== true) {
      multi[current] = [values[current], next];
      delete values[current];
    } else {
      values[current] = next;
    }
  }

  return {
    positionals,
    values,
    multi,
    flags
  };
}

function readBooleanOption(parsed, name, defaultValue) {
  const value = parsed.values[name];
  return typeof value === "boolean" ? value : defaultValue;
}
