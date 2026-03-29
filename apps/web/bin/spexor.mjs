#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deployAwsHub,
  deployCloudflareHub,
  printHelp,
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
    case "setup": {
      const result = await setupProject({ projectRoot });
      if (result.created.length === 0) {
        console.log("[spexor] project already initialized");
      } else {
        console.log("[spexor] created:");
        for (const created of result.created) {
          console.log(`  - ${created}`);
        }
      }
      return;
    }
    case "hub":
      await handleHubCommand(args.slice(1));
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      console.error(`[spexor] unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function handleHubCommand(subcommandArgs) {
  const action = subcommandArgs[0];
  const provider = subcommandArgs[1];

  if (action !== "deploy" || !provider) {
    printHelp();
    process.exit(1);
  }

  switch (provider) {
    case "cloudflare":
      await deployCloudflareHub({ projectRoot });
      return;
    case "aws":
      await deployAwsHub({ projectRoot });
      return;
    default:
      console.error(`[spexor] unknown hub provider: ${provider}`);
      printHelp();
      process.exit(1);
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
