import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const RESULTS_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS shared_run_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  run_id TEXT NOT NULL,
  tester_name TEXT NOT NULL,
  browser TEXT,
  platform TEXT,
  status TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attachments_json TEXT NOT NULL,
  source_json TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_run_events_project_scenario_created
  ON shared_run_events(project_id, scenario_key, created_at DESC);
`;

export async function setupProject(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const created = [];

  const specsDir = path.join(projectRoot, "specs/manual");
  const evidenceDir = path.join(projectRoot, ".spexor/evidence");
  const configPath = path.join(projectRoot, "spexor.config.ts");
  const exampleFeaturePath = path.join(
    projectRoot,
    "specs/manual/getting-started.feature"
  );

  await ensureDirectory(specsDir);
  await ensureDirectory(evidenceDir);

  if (await writeIfMissing(configPath, defaultSpexorConfigTemplate())) {
    created.push(relativePath(projectRoot, configPath));
  }

  if (await writeIfMissing(exampleFeaturePath, starterFeatureTemplate())) {
    created.push(relativePath(projectRoot, exampleFeaturePath));
  }

  return {
    projectRoot,
    created
  };
}

export async function scaffoldCloudflareHub(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const slug = slugify(path.basename(projectRoot));
  const hubDir = path.join(projectRoot, ".spexor/results-hub/cloudflare");
  const workerName = `${slug}-results-hub`;
  const databaseName = `${slug}-results-hub`;

  await ensureDirectory(path.join(hubDir, "src"));

  await fs.writeFile(
    path.join(hubDir, "package.json"),
    cloudflarePackageTemplate(),
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "src/index.ts"),
    'export { default } from "@spexor/results-hub/cloudflare";\n',
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "schema.sql"),
    RESULTS_SCHEMA_SQL,
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "wrangler.toml"),
    cloudflareWranglerTemplate(workerName, databaseName),
    "utf8"
  );

  return {
    hubDir,
    workerName,
    databaseName
  };
}

export async function scaffoldAwsHub(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const slug = slugify(path.basename(projectRoot));
  const hubDir = path.join(projectRoot, ".spexor/results-hub/aws");
  const stackName = `${pascalCase(slug)}ResultsHubStack`;

  await ensureDirectory(path.join(hubDir, "bin"));
  await ensureDirectory(path.join(hubDir, "lib"));
  await ensureDirectory(path.join(hubDir, "lambda"));

  await fs.writeFile(
    path.join(hubDir, "package.json"),
    awsPackageTemplate(),
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "tsconfig.json"),
    awsTsconfigTemplate(),
    "utf8"
  );
  await fs.writeFile(path.join(hubDir, "cdk.json"), awsCdkTemplate(), "utf8");
  await fs.writeFile(
    path.join(hubDir, "bin/results-hub.ts"),
    awsBinTemplate(stackName),
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "lib/results-hub-stack.ts"),
    awsStackTemplate(stackName),
    "utf8"
  );
  await fs.writeFile(
    path.join(hubDir, "lambda/index.ts"),
    awsLambdaTemplate(),
    "utf8"
  );

  return {
    hubDir,
    stackName
  };
}

export async function deployCloudflareHub(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const run = options.runner ?? runCommand;

  await setupProject({ projectRoot });
  const scaffolded = await scaffoldCloudflareHub({ projectRoot });

  await run("npm", ["install"], { cwd: scaffolded.hubDir });

  const wranglerTomlPath = path.join(scaffolded.hubDir, "wrangler.toml");
  const wranglerToml = await fs.readFile(wranglerTomlPath, "utf8");

  if (wranglerToml.includes('database_id = "replace-me"')) {
    const createOutput = await run(
      "npm",
      ["exec", "wrangler", "d1", "create", scaffolded.databaseName],
      {
        cwd: scaffolded.hubDir,
        captureOutput: true
      }
    );
    const databaseId = extractUuid(createOutput.stdout);
    if (!databaseId) {
      throw new Error(
        "Could not determine the created Cloudflare D1 database id."
      );
    }

    await fs.writeFile(
      wranglerTomlPath,
      wranglerToml.replace(
        'database_id = "replace-me"',
        `database_id = "${databaseId}"`
      ),
      "utf8"
    );
  }

  await run(
    "npm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      scaffolded.databaseName,
      "--remote",
      "--file",
      "schema.sql"
    ],
    { cwd: scaffolded.hubDir }
  );
  await run("npm", ["exec", "wrangler", "deploy"], {
    cwd: scaffolded.hubDir
  });

  return scaffolded;
}

export async function deployAwsHub(options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const run = options.runner ?? runCommand;

  await setupProject({ projectRoot });
  const scaffolded = await scaffoldAwsHub({ projectRoot });

  await run("npm", ["install"], { cwd: scaffolded.hubDir });
  await run("npm", ["exec", "cdk", "bootstrap"], {
    cwd: scaffolded.hubDir
  });
  await run("npm", ["exec", "cdk", "deploy", "--require-approval", "never"], {
    cwd: scaffolded.hubDir
  });

  return scaffolded;
}

export async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.captureOutput ? "pipe" : "inherit"
    });

    let stdout = "";
    let stderr = "";

    if (options.captureOutput) {
      child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        stdout += text;
        process.stdout.write(text);
      });
      child.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        stderr += text;
        process.stderr.write(text);
      });
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      if ((code ?? 0) === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed (${code ?? "unknown"}): ${command} ${args.join(" ")}`
        )
      );
    });
  });
}

export function printHelp() {
  console.log(`Spexor

Usage:
  spexor dev
  spexor api
  spexor setup
  spexor hub deploy cloudflare
  spexor hub deploy aws
`);
}

function defaultSpexorConfigTemplate() {
  return `export default {
  specDir: "./specs/manual",
  dbPath: "./.spexor/spexor.db",
  evidenceDir: "./.spexor/evidence",
  autoScan: true
};
`;
}

function starterFeatureTemplate() {
  return `---
title: Getting started
tags:
  - smoke
---

Feature: Spexor project bootstrap

  Scenario: Record the first manual run
    Given Spexor is installed in this repository
    When a tester opens the local app
    Then they can record a result without editing the feature file
`;
}

function cloudflarePackageTemplate() {
  return `{
  "name": "spexor-results-hub-cloudflare",
  "private": true,
  "type": "module",
  "devDependencies": {
    "wrangler": "^4.39.0"
  }
}
`;
}

function cloudflareWranglerTemplate(workerName, databaseName) {
  return `name = "${workerName}"
main = "src/index.ts"
compatibility_date = "2026-03-30"

[[d1_databases]]
binding = "RESULTS_DB"
database_name = "${databaseName}"
database_id = "replace-me"
`;
}

function awsPackageTemplate() {
  return `{
  "name": "spexor-results-hub-aws",
  "private": true,
  "type": "module",
  "scripts": {
    "bootstrap": "npm exec cdk bootstrap",
    "deploy": "npm exec cdk deploy --require-approval never"
  },
  "devDependencies": {
    "aws-cdk": "^2.1008.0",
    "aws-cdk-lib": "^2.221.0",
    "constructs": "^10.4.2",
    "esbuild": "^0.25.10",
    "tsx": "^4.20.5",
    "typescript": "^5.9.3"
  }
}
`;
}

function awsTsconfigTemplate() {
  return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["bin", "lib", "lambda"]
}
`;
}

function awsCdkTemplate() {
  return `{
  "app": "node --import tsx ./bin/results-hub.ts"
}
`;
}

function awsBinTemplate(stackName) {
  return `import { App } from "aws-cdk-lib";
import { ${stackName} } from "../lib/results-hub-stack";

const app = new App();
new ${stackName}(app, "${stackName}");
`;
}

function awsStackTemplate(stackName) {
  return `import path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import { BlockPublicAccess, Bucket, HttpMethods } from "aws-cdk-lib/aws-s3";
import { Runtime, FunctionUrlAuthType, HttpMethod } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

const stackDir = path.dirname(fileURLToPath(import.meta.url));

export class ${stackName} extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const bucket = new Bucket(this, "SharedResultsBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [HttpMethods.GET, HttpMethods.POST],
          allowedHeaders: ["*"]
        }
      ],
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    const handler = new NodejsFunction(this, "ResultsHubHandler", {
      entry: path.resolve(stackDir, "../lambda/index.ts"),
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      environment: {
        RESULTS_BUCKET_NAME: bucket.bucketName
      }
    });

    bucket.grantReadWrite(handler);

    const functionUrl = handler.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedMethods: [HttpMethod.GET, HttpMethod.POST],
        allowedOrigins: ["*"],
        allowedHeaders: ["*"]
      }
    });

    new CfnOutput(this, "ResultsHubUrl", {
      value: functionUrl.url
    });
    new CfnOutput(this, "ResultsHubBucket", {
      value: bucket.bucketName
    });
  }
}
`;
}

function awsLambdaTemplate() {
  return `import { createAwsLambdaHandler } from "@spexor/results-hub/aws-lambda";

const bucketName = process.env.RESULTS_BUCKET_NAME;

if (!bucketName) {
  throw new Error("RESULTS_BUCKET_NAME is required.");
}

export const handler = createAwsLambdaHandler({
  bucketName
});
`;
}

async function writeIfMissing(filePath, content) {
  try {
    await fs.access(filePath);
    return false;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      throw error;
    }
  }

  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return true;
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

function relativePath(projectRoot, filePath) {
  return path.relative(projectRoot, filePath) || ".";
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "spexor"
  );
}

function pascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function extractUuid(text) {
  return text.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  )?.[0];
}
