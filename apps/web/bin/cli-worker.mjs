import fs from "node:fs/promises";
import path from "node:path";
import { createSpexorApp } from "@spexor/app";
import { loadConfig } from "@spexor/config";

const [, , command, rawInput = "{}"] = process.argv;

try {
  const input = JSON.parse(rawInput);
  const result = await handleCommand(command, input);
  process.stdout.write(JSON.stringify(result));
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Unknown CLI worker error"}\n`
  );
  process.exit(1);
}

async function handleCommand(commandName, input) {
  switch (commandName) {
    case "resolve-config":
      return resolveConfig(input);
    case "doctor":
      return doctorProject(input);
    case "scan":
      return scanProject(input);
    case "status":
      return getProjectStatus(input);
    case "export-results":
      return exportProjectResults(input);
    default:
      throw new Error(`Unknown worker command: ${commandName}`);
  }
}

async function resolveConfig(input) {
  const config = await loadConfig({ cwd: input.projectRoot });
  return {
    specDir: config.specDir,
    dbPath: config.dbPath,
    evidenceDir: config.evidenceDir,
    autoScan: config.autoScan,
    sharedResults: config.sharedResults
  };
}

async function doctorProject(input) {
  const projectRoot = path.resolve(input.projectRoot ?? process.cwd());
  const checks = [];
  const packageJsonPath = path.join(projectRoot, "package.json");
  const configPath = path.join(projectRoot, "spexor.config.ts");

  checks.push({
    id: "node",
    status: "ok",
    message: `Node ${process.version}`
  });

  const packageJson = await readJson(packageJsonPath);
  if (packageJson?.packageManager) {
    checks.push({
      id: "package-manager",
      status: "ok",
      message: `packageManager ${packageJson.packageManager}`
    });
  } else {
    checks.push({
      id: "package-manager",
      status: "warn",
      message: "package.json or packageManager field not found"
    });
  }

  const configExists = await pathExists(configPath);
  if (!configExists) {
    checks.push({
      id: "config",
      status: "warn",
      message: "spexor.config.ts not found; defaults will be used"
    });
  }

  try {
    const config = await loadConfig({ cwd: projectRoot });

    if (configExists) {
      checks.push({
        id: "config-parse",
        status: "ok",
        message: `Loaded ${path.basename(config.configPath ?? configPath)}`
      });
    }

    checks.push({
      id: "spec-dir",
      status: (await pathExists(config.specDirAbs)) ? "ok" : "warn",
      message: `${config.specDir} -> ${
        (await pathExists(config.specDirAbs)) ? "found" : "missing"
      }`
    });

    checks.push({
      id: "db-dir",
      status: (await canCreateParent(config.dbPathAbs)) ? "ok" : "error",
      message: path.dirname(config.dbPathAbs)
    });

    checks.push({
      id: "evidence-dir",
      status: (await canCreatePath(config.evidenceDirAbs)) ? "ok" : "error",
      message: config.evidenceDir
    });

    checks.push({
      id: "shared-results",
      status: config.sharedResults ? "ok" : "warn",
      message: config.sharedResults
        ? `${config.sharedResults.baseUrl} (${config.sharedResults.projectId})`
        : "sharedResults is not configured"
    });
  } catch (error) {
    checks.push({
      id: "config-parse",
      status: "error",
      message: error instanceof Error ? error.message : "Invalid Spexor config"
    });
  }

  const errorCount = checks.filter((check) => check.status === "error").length;

  return {
    ok: errorCount === 0,
    checks
  };
}

async function scanProject(input) {
  const app = await createSpexorApp({ rootDir: input.projectRoot });

  try {
    const sync = await app.syncSpecsFromFilesystem();
    const items = await app.getSpecsList();
    return {
      processedCount: sync.processedCount,
      featureCount: items.length
    };
  } finally {
    await app.close();
  }
}

async function getProjectStatus(input) {
  const app = await createSpexorApp({ rootDir: input.projectRoot });

  try {
    const items = await app.getSpecsList();
    const health = app.getHealth();
    const exported = await app.exportRunResultsNdjson();

    return {
      featureCount: items.length,
      scenarioCount: items.reduce(
        (total, item) => total + item.scenarioCount,
        0
      ),
      issueCount: items.reduce((total, item) => total + item.issueCount, 0),
      parseHealth: {
        ok: items.filter((item) => item.parseHealth === "ok").length,
        warning: items.filter((item) => item.parseHealth === "warning").length,
        error: items.filter((item) => item.parseHealth === "error").length
      },
      recordedRunCount: exported.itemCount,
      sharedResultsEnabled: Boolean(health.config.sharedResults),
      sharedResultsProjectId: health.config.sharedResults?.projectId
    };
  } finally {
    await app.close();
  }
}

async function exportProjectResults(input) {
  const app = await createSpexorApp({ rootDir: input.projectRoot });

  try {
    const exported = await app.exportRunResultsNdjson();

    if (input.stdout) {
      return {
        ...exported,
        outputPath: null
      };
    }

    const outputPath =
      input.outputPath ??
      path.join(input.projectRoot, ".spexor/exports/results.ndjson");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, exported.ndjson, "utf8");

    return {
      ...exported,
      outputPath
    };
  } finally {
    await app.close();
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
    return false;
  }
}

async function canCreateParent(targetPath) {
  return canCreatePath(path.dirname(targetPath));
}

async function canCreatePath(targetPath) {
  try {
    await fs.mkdir(targetPath, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
