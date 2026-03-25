import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { workspaceAliases } from "../../vite.workspace-aliases";

const webDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(webDir, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: workspaceAliases
  },
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
      allow: [workspaceRoot]
    }
  }
});
