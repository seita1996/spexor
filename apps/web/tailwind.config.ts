import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "tailwindcss";

const require = createRequire(import.meta.url);
const webRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoUiPath = path.resolve(webRoot, "../../packages/ui/src");
const installedUiPackage = resolvePackageSource("@spexor/ui");

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    ...(fs.existsSync(monorepoUiPath) ? ["../../packages/ui/src/**/*.{ts,tsx}"] : []),
    ...(installedUiPackage ? [`${installedUiPackage}/src/**/*.{ts,tsx}`] : [])
  ],
  theme: {
    extend: {
      colors: {
        spexor: {
          ink: "#0f172a",
          mist: "#eff6ff",
          sand: "#f8f4ea",
          teal: "#0f766e",
          rust: "#b45309"
        }
      },
      boxShadow: {
        floaty: "0 24px 70px -40px rgba(15, 23, 42, 0.45)"
      }
    }
  },
  plugins: []
} satisfies Config;

function resolvePackageSource(packageName: string): string | null {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}
