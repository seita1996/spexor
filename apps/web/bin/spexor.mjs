#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const binDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(binDir, "..");
const command = process.argv[2] ?? "dev";
const projectRoot = process.cwd();
const env = {
  ...process.env,
  SPEXOR_PROJECT_ROOT: projectRoot
};

switch (command) {
  case "dev":
    runDev();
    break;
  case "api":
    runSingleProcess([
      "--import",
      "tsx",
      path.join(packageRoot, "server/index.ts")
    ]);
    break;
  case "help":
  case "--help":
  case "-h":
    printHelp();
    break;
  default:
    console.error(`[spexor] unknown command: ${command}`);
    printHelp();
    process.exit(1);
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

function printHelp() {
  console.log(`Spexor

Usage:
  spexor dev   Start the local Spexor GUI for the current project
  spexor api   Start only the local API server for the current project
`);
}
