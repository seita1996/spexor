import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSpexorApp, type RecordScenarioResultInput } from "@spexor/app";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot =
  process.env.SPEXOR_PROJECT_ROOT || findWorkspaceRoot(serverDir);
const port = Number(process.env.SPEXOR_API_PORT ?? 4318);

const spexor = await createSpexorApp({ rootDir: projectRoot });

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url ?? "/",
    `http://${request.headers.host ?? "localhost"}`
  );
  const { pathname } = url;

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      return writeJson(response, 200, spexor.getHealth());
    }

    if (request.method === "GET" && pathname === "/api/specs") {
      const items = await spexor.getSpecsList();
      return writeJson(response, 200, items);
    }

    if (request.method === "POST" && pathname === "/api/sync") {
      const sync = await spexor.syncSpecsFromFilesystem();
      const items = await spexor.getSpecsList();
      return writeJson(response, 200, { sync, items });
    }

    if (request.method === "GET" && pathname.startsWith("/api/features/")) {
      const featureId = decodeURIComponent(
        pathname.slice("/api/features/".length)
      );
      const detail = await spexor.getFeatureDetail(featureId);
      if (!detail) {
        return writeJson(response, 404, {
          error: `Feature not found: ${featureId}`
        });
      }
      return writeJson(response, 200, detail);
    }

    if (
      request.method === "GET" &&
      pathname.startsWith("/api/scenarios/") &&
      pathname.endsWith("/history")
    ) {
      const scenarioId = decodeURIComponent(
        pathname.slice(
          "/api/scenarios/".length,
          pathname.length - "/history".length
        )
      );
      const history = await spexor.getScenarioHistory(scenarioId);
      if (!history) {
        return writeJson(response, 404, {
          error: `Scenario not found: ${scenarioId}`
        });
      }
      return writeJson(response, 200, history);
    }

    if (
      request.method === "POST" &&
      pathname.startsWith("/api/scenarios/") &&
      pathname.endsWith("/runs")
    ) {
      const scenarioId = decodeURIComponent(
        pathname.slice(
          "/api/scenarios/".length,
          pathname.length - "/runs".length
        )
      );
      const body = await readJsonBody(request);
      const result = await spexor.recordScenarioResult(
        scenarioId,
        body as RecordScenarioResultInput
      );
      return writeJson(response, 201, result);
    }

    writeJson(response, 404, { error: "Route not found." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    writeJson(response, 500, { error: message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[spexor] api listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void spexor.close().finally(() => {
      server.close(() => {
        process.exit(0);
      });
    });
  });
}

async function readJsonBody(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as unknown) : {};
}

function writeJson(
  response: http.ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;

  while (true) {
    if (
      fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml")) &&
      fs.existsSync(path.join(currentDir, "spexor.config.ts"))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(startDir, "../../..");
    }

    currentDir = parentDir;
  }
}
