import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const workspaceRoot = path.resolve(webDir, "../..");
const monorepoMode = fs.existsSync(path.join(workspaceRoot, "pnpm-workspace.yaml"));
const installedUiRoot = safeResolvePackageRoot("@spexor/ui");
const workspaceAliases = monorepoMode
  ? {
      "@spexor/app": path.resolve(workspaceRoot, "packages/app/src"),
      "@spexor/config": path.resolve(workspaceRoot, "packages/config/src"),
      "@spexor/db": path.resolve(workspaceRoot, "packages/db/src"),
      "@spexor/domain": path.resolve(workspaceRoot, "packages/domain/src"),
      "@spexor/parser": path.resolve(workspaceRoot, "packages/parser/src"),
      "@spexor/ui": path.resolve(workspaceRoot, "packages/ui/src")
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  ...(workspaceAliases ? { resolve: { alias: workspaceAliases } } : {}),
  server: {
    host: "127.0.0.1",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4318",
        changeOrigin: true
      }
    },
    fs: {
      allow: [monorepoMode ? workspaceRoot : webDir, ...(installedUiRoot ? [installedUiRoot] : [])]
    }
  }
});

function safeResolvePackageRoot(packageName: string): string | null {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}
