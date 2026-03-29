import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export const workspaceAliases = {
  "@spexor/app": path.resolve(rootDir, "packages/app/src"),
  "@spexor/config": path.resolve(rootDir, "packages/config/src"),
  "@spexor/db": path.resolve(rootDir, "packages/db/src"),
  "@spexor/domain": path.resolve(rootDir, "packages/domain/src"),
  "@spexor/parser": path.resolve(rootDir, "packages/parser/src"),
  "@spexor/results": path.resolve(rootDir, "packages/results/src"),
  "@spexor/ui": path.resolve(rootDir, "packages/ui/src")
};
