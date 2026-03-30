import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  findWorkspacePackageJsonPaths,
  normalizeVersion,
  resolveReleaseVersion,
  syncWorkspaceVersions
} from "./version.mjs";

describe("release version script", () => {
  it("normalizes tags into plain semver", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
    expect(normalizeVersion("1.2.3-beta.1")).toBe("1.2.3-beta.1");
  });

  it("rejects invalid versions", () => {
    expect(() => normalizeVersion("main")).toThrow("Invalid release version");
  });

  it("resolves an explicit version argument", async () => {
    await expect(resolveReleaseVersion(["1.4.0"])).resolves.toBe("1.4.0");
  });

  it("resolves a git tag when requested", async () => {
    await expect(
      resolveReleaseVersion(["--from-tag"], {
        loadTag: async () => "v2.0.0"
      })
    ).resolves.toBe("2.0.0");
  });

  it("updates root and workspace package versions together", async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-release-"));

    await fs.mkdir(path.join(cwd, "apps", "web"), { recursive: true });
    await fs.mkdir(path.join(cwd, "packages", "domain"), { recursive: true });
    await fs.mkdir(path.join(cwd, "packages", "parser"), { recursive: true });

    await fs.writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "spexor", version: "0.1.0", private: true }, null, 2)}\n`
    );
    await fs.writeFile(
      path.join(cwd, "apps", "web", "package.json"),
      `${JSON.stringify({ name: "@spexor/web", version: "0.1.0" }, null, 2)}\n`
    );
    await fs.writeFile(
      path.join(cwd, "packages", "domain", "package.json"),
      `${JSON.stringify({ name: "@spexor/domain", version: "0.1.0" }, null, 2)}\n`
    );
    await fs.writeFile(
      path.join(cwd, "packages", "parser", "package.json"),
      `${JSON.stringify({ name: "@spexor/parser", version: "0.1.0" }, null, 2)}\n`
    );

    const packageJsonPaths = await findWorkspacePackageJsonPaths(cwd);
    expect(packageJsonPaths).toHaveLength(4);

    const updated = await syncWorkspaceVersions({ cwd, version: "0.2.0" });
    expect(updated).toHaveLength(4);

    await expect(
      fs.readFile(path.join(cwd, "package.json"), "utf8")
    ).resolves.toContain('"version": "0.2.0"');
    await expect(
      fs.readFile(path.join(cwd, "apps", "web", "package.json"), "utf8")
    ).resolves.toContain('"version": "0.2.0"');
    await expect(
      fs.readFile(path.join(cwd, "packages", "parser", "package.json"), "utf8")
    ).resolves.toContain('"version": "0.2.0"');
  });
});
