import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSpexorApp } from "@spexor/app";
import {
  createSpecFile,
  deployAwsHub,
  deployCloudflareHub,
  exportResults,
  getProjectStatus,
  initHub,
  initProject,
  initializeConfig,
  linkSharedResults,
  runDoctor,
  runScan,
  scaffoldAwsHub,
  scaffoldCloudflareHub,
  setupProject
} from "./cli-lib.mjs";

describe("spexor cli helpers", () => {
  it("bootstraps a project config and starter feature", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-setup-")
    );

    const result = await setupProject({ projectRoot });

    expect(result.created).toContain("spexor.config.ts");
    expect(result.created).toContain("specs/manual/getting-started.feature");
    await expect(
      fs.readFile(path.join(projectRoot, "spexor.config.ts"), "utf8")
    ).resolves.toContain('specDir: "./specs/manual"');
  });

  it("initializes a project without the starter feature when requested", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-init-")
    );

    const result = await initProject({ projectRoot, includeStarter: false });

    expect(result.created).toContain("spexor.config.ts");
    expect(result.created).not.toContain(
      "specs/manual/getting-started.feature"
    );
  });

  it("writes a custom config file", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-config-")
    );

    const result = await initializeConfig({
      projectRoot,
      specDir: "./specs/qa",
      dbPath: "./.cache/spexor.db",
      evidenceDir: "./artifacts/evidence",
      autoScan: false,
      sharedResults: {
        baseUrl: "https://results.example.com",
        projectId: "qa-console"
      }
    });

    expect(result.changed).toBe(true);
    await expect(
      fs.readFile(path.join(projectRoot, "spexor.config.ts"), "utf8")
    ).resolves.toContain(
      'sharedResults: {\n    baseUrl: "https://results.example.com"'
    );
  });

  it("creates a spec file from metadata", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-spec-")
    );
    await initializeConfig({
      projectRoot,
      specDir: "./manual-specs",
      autoScan: false
    });

    const result = await createSpecFile({
      projectRoot,
      title: "Checkout flow",
      filePath: "commerce/checkout",
      scenarioTitle: "Complete a purchase",
      tags: ["checkout", "smoke"],
      browsers: ["chrome"],
      platforms: ["mac"],
      priority: "high",
      owner: "qa@example.com",
      related: ["https://example.com/issues/123"]
    });

    expect(result.relativePath).toBe("commerce/checkout.feature");
    await expect(fs.readFile(result.filePath, "utf8")).resolves.toContain(
      "Scenario: Complete a purchase"
    );
    await expect(fs.readFile(result.filePath, "utf8")).resolves.toContain(
      "  - checkout"
    );
  });

  it("links shared results into an existing config", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-link-")
    );
    await initializeConfig({ projectRoot });

    const result = await linkSharedResults({
      projectRoot,
      baseUrl: "https://results.example.com",
      projectId: "qa-console"
    });

    expect(result.changed).toBe(true);
    await expect(
      fs.readFile(path.join(projectRoot, "spexor.config.ts"), "utf8")
    ).resolves.toContain('projectId: "qa-console"');
  });

  it("scaffolds a Cloudflare hub project", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-cloudflare-")
    );

    const result = await scaffoldCloudflareHub({ projectRoot });

    await expect(
      fs.readFile(path.join(result.hubDir, "wrangler.toml"), "utf8")
    ).resolves.toContain('database_id = "replace-me"');
    await expect(
      fs.readFile(path.join(result.hubDir, "src/index.ts"), "utf8")
    ).resolves.toContain("@spexor/results-hub/cloudflare");
  });

  it("scaffolds an AWS hub project", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-aws-")
    );

    const result = await scaffoldAwsHub({ projectRoot });

    await expect(
      fs.readFile(path.join(result.hubDir, "lambda/index.ts"), "utf8")
    ).resolves.toContain("@spexor/results-hub/aws-lambda");
    await expect(
      fs.readFile(path.join(result.hubDir, "lib/results-hub-stack.ts"), "utf8")
    ).resolves.toContain("FunctionUrlAuthType.NONE");
  });

  it("runs the Cloudflare deploy flow in order", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-cloudflare-deploy-")
    );
    const calls = [];

    await deployCloudflareHub({
      projectRoot,
      runner: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        if (args.slice(0, 4).join(" ") === "exec wrangler d1 create") {
          return {
            stdout: "database_id = 123e4567-e89b-12d3-a456-426614174000\n",
            stderr: ""
          };
        }
        return { stdout: "", stderr: "" };
      }
    });

    expect(calls[0]?.args.join(" ")).toBe("install");
    expect(calls[1]?.args.slice(0, 4).join(" ")).toBe(
      "exec wrangler d1 create"
    );
    expect(calls[2]?.args.slice(0, 4).join(" ")).toBe(
      "exec wrangler d1 execute"
    );
    expect(calls[2]?.args.at(-1)).toBe("schema.sql");
    expect(calls[3]?.args.join(" ")).toBe("exec wrangler deploy");
  });

  it("runs the AWS deploy flow in order", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-aws-deploy-")
    );
    const calls = [];

    await deployAwsHub({
      projectRoot,
      runner: async (command, args, options) => {
        calls.push({ command, args, cwd: options.cwd });
        return { stdout: "", stderr: "" };
      }
    });

    expect(calls.map((call) => call.args.join(" "))).toEqual([
      "install",
      "exec cdk bootstrap",
      "exec cdk deploy --require-approval never"
    ]);
  });

  it("scaffolds hub files through the generic hub init helper", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-hub-init-")
    );

    const result = await initHub({
      projectRoot,
      provider: "cloudflare"
    });

    await expect(
      fs.readFile(path.join(result.hubDir, "wrangler.toml"), "utf8")
    ).resolves.toContain('database_id = "replace-me"');
  });

  it("reports diagnostics, scans specs, shows status, and exports results", async () => {
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-cli-worker-")
    );
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.15.1" }, null, 2),
      "utf8"
    );
    await initializeConfig({
      projectRoot,
      autoScan: false,
      sharedResults: {
        baseUrl: "https://results.example.com",
        projectId: "qa-console"
      }
    });
    await createSpecFile({
      projectRoot,
      title: "Login flow",
      filePath: "login"
    });

    const doctor = await runDoctor({ projectRoot });
    expect(doctor.ok).toBe(true);
    expect(doctor.checks.some((check) => check.id === "config-parse")).toBe(
      true
    );

    const scan = await runScan({ projectRoot });
    expect(scan.featureCount).toBe(1);

    const app = await createSpexorApp({ rootDir: projectRoot });
    const detail = await app.getFeatureDetail("specs/manual/login.feature");
    const scenarioId = detail?.scenarioGroups[0]?.cases[0]?.id;
    expect(scenarioId).toBeDefined();
    await app.recordScenarioResult(scenarioId ?? "", {
      testerName: "qa@example.com",
      status: "passed",
      notes: "verified"
    });
    await app.close();

    const status = await getProjectStatus({ projectRoot });
    expect(status.featureCount).toBe(1);
    expect(status.recordedRunCount).toBe(1);
    expect(status.sharedResultsEnabled).toBe(true);

    const exported = await exportResults({ projectRoot });
    expect(exported.itemCount).toBe(1);
    await expect(fs.readFile(exported.outputPath, "utf8")).resolves.toContain(
      '"testerName":"qa@example.com"'
    );
  });
});
