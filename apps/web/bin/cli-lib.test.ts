import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  deployAwsHub,
  deployCloudflareHub,
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
});
