import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

export interface SpexorConfig {
  specDir: string;
  dbPath: string;
  evidenceDir: string;
  autoScan: boolean;
}

export interface ResolvedSpexorConfig extends SpexorConfig {
  rootDir: string;
  configPath?: string | undefined;
  specDirAbs: string;
  dbPathAbs: string;
  evidenceDirAbs: string;
}

const defaultConfig: SpexorConfig = {
  specDir: "./specs/manual",
  dbPath: "./.spexor/spexor.db",
  evidenceDir: "./.spexor/evidence",
  autoScan: true
};

const configSchema = z
  .object({
    specDir: z.string().min(1).default(defaultConfig.specDir),
    dbPath: z.string().min(1).default(defaultConfig.dbPath),
    evidenceDir: z.string().min(1).default(defaultConfig.evidenceDir),
    autoScan: z.boolean().default(defaultConfig.autoScan)
  })
  .passthrough();

export async function loadConfig(
  options: { cwd?: string } = {}
): Promise<ResolvedSpexorConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const configPath = path.resolve(cwd, "spexor.config.ts");

  try {
    await fs.access(configPath);
    const imported = await import(
      `${pathToFileURL(configPath).href}?t=${Date.now()}`
    );
    const parsed = configSchema.parse(imported.default ?? imported);
    return resolveConfigPaths(parsed, cwd, configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return resolveConfigPaths(defaultConfig, cwd);
    }

    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid Spexor config at ${configPath}: ${error.message}`
      );
    }

    throw error;
  }
}

export function resolveConfigPaths(
  config: Partial<SpexorConfig>,
  cwd = process.cwd(),
  configPath?: string
): ResolvedSpexorConfig {
  const parsed = configSchema.parse(config);
  const rootDir = path.resolve(cwd);

  return {
    ...parsed,
    rootDir,
    configPath,
    specDirAbs: path.resolve(rootDir, parsed.specDir),
    dbPathAbs: path.resolve(rootDir, parsed.dbPath),
    evidenceDirAbs: path.resolve(rootDir, parsed.evidenceDir)
  };
}

export { defaultConfig };
