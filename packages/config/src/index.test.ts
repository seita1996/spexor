import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig, resolveConfigPaths } from "./index";

describe("@spexor/config", () => {
  it("falls back to defaults when no config file exists", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-config-defaults-"));

    const config = await loadConfig({ cwd: tempRoot });

    expect(config.specDir).toBe("./specs/manual");
    expect(config.dbPath).toBe("./.spexor/spexor.db");
    expect(config.specDirAbs).toBe(path.resolve(tempRoot, "./specs/manual"));
  });

  it("loads a custom spexor.config.ts file", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-config-custom-"));
    await fs.writeFile(
      path.join(tempRoot, "spexor.config.ts"),
      `export default {
        specDir: "./specs/manual",
        dbPath: "./tmp/history.db",
        evidenceDir: "./tmp/evidence",
        autoScan: false
      };`,
      "utf8"
    );

    const config = await loadConfig({ cwd: tempRoot });

    expect(config.specDirAbs).toBe(path.resolve(tempRoot, "specs/manual"));
    expect(config.dbPathAbs).toBe(path.resolve(tempRoot, "tmp/history.db"));
    expect(config.autoScan).toBe(false);
  });

  it("resolves paths from a partial config object", () => {
    const resolved = resolveConfigPaths({ specDir: "./manual" }, "/workspace/demo");

    expect(resolved.specDirAbs).toBe("/workspace/demo/manual");
    expect(resolved.dbPathAbs).toBe("/workspace/demo/.spexor/spexor.db");
    expect(resolved.evidenceDirAbs).toBe("/workspace/demo/.spexor/evidence");
  });
});
