import path from "node:path";
import { defineConfig } from "@playwright/test";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm --filter @spexor/spexor dev",
    cwd: workspaceRoot,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env["CI"],
    timeout: 120000
  }
});
