import { defineConfig } from "vitest/config";
import { workspaceAliases } from "./vite.workspace-aliases";

export default defineConfig({
  resolve: {
    alias: workspaceAliases
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "packages/**/*.test.ts",
      "packages/**/*.test.tsx",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx"
    ]
  }
});
