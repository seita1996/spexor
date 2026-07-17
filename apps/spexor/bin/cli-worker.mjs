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
    case "export-run":
      return exportVerificationRun(input);
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

    if (await pathExists(config.specDirAbs)) {
      const app = await createSpexorApp({ rootDir: projectRoot });
      try {
        const catalog = await app.getSpecCatalog();
        const identity = summarizeIdentity(catalog);
        checks.push({
          id: "spec-identity",
          status:
            identity.invalid > 0
              ? "error"
              : identity.legacy > 0
                ? "warn"
                : "ok",
          message: `features(explicit=${identity.features.explicit}, legacy=${identity.features.legacy}) scenarios(explicit=${identity.scenarios.explicit}, legacy=${identity.scenarios.legacy}) invalid=${identity.invalid}`
        });
      } finally {
        await app.close();
      }
    }
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
    const catalog = await app.getSpecCatalog();
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
      identity: summarizeIdentity(catalog),
      sharedResultsEnabled: Boolean(health.config.sharedResults),
      sharedResultsProjectId: health.config.sharedResults?.projectId
    };
  } finally {
    await app.close();
  }
}

function summarizeIdentity(catalog) {
  const scenarioIdentities = catalog.features.flatMap((feature) =>
    feature.scenarioGroups.flatMap((group) =>
      group.cases.map((scenario) => scenario.identity)
    )
  );
  return {
    features: countIdentitySources(catalog.items.map((item) => item.identity)),
    scenarios: countIdentitySources(scenarioIdentities),
    legacy:
      catalog.items.filter((item) => item.identity.source === "legacy").length +
      scenarioIdentities.filter((identity) => identity.source === "legacy")
        .length,
    invalid: catalog.items.reduce(
      (total, item) =>
        total +
        item.issues.filter((issue) =>
          ["identity_invalid", "identity_duplicate"].includes(issue.code)
        ).length,
      0
    )
  };
}

function countIdentitySources(identities) {
  return {
    explicit: identities.filter((identity) => identity.source === "explicit")
      .length,
    legacy: identities.filter((identity) => identity.source === "legacy").length
  };
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

async function exportVerificationRun(input) {
  const app = await createSpexorApp({ rootDir: input.projectRoot });

  try {
    const exported = await app.exportVerificationRun(input.runId, input.format);
    if (input.stdout) {
      return { ...exported, outputPath: null };
    }
    const extension =
      input.format === "markdown"
        ? "md"
        : input.format === "junit"
          ? "xml"
          : "json";
    const outputPath =
      input.outputPath ??
      path.join(
        input.projectRoot,
        `.spexor/exports/run-${input.runId}.${extension}`
      );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, exported.content, "utf8");
    return { ...exported, outputPath };
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
