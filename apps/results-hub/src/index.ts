import {
  parseSharedRunEventsNdjson,
  type SharedRunEvent
} from "@spexor/results";

export interface SharedResultsStore {
  ingest(projectId: string, events: SharedRunEvent[]): Promise<number>;
  getScenarioResults(
    projectId: string,
    scenarioKey: string
  ): Promise<SharedRunEvent[]>;
}

export function createResultsHubHandler(store: SharedResultsStore) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return writeJson(200, { ok: true });
    }

    const pathMatch = matchProjectPath(url.pathname);

    if (
      request.method === "POST" &&
      pathMatch?.kind === "import" &&
      pathMatch.projectId
    ) {
      const body = await request.text();
      const events = parseSharedRunEventsNdjson(body);
      const mismatchedEvent = events.find(
        (event) => event.projectId !== pathMatch.projectId
      );

      if (mismatchedEvent) {
        return writeJson(400, {
          error: `Project id mismatch for event ${mismatchedEvent.eventId}`
        });
      }

      const acceptedCount = await store.ingest(pathMatch.projectId, events);
      return writeJson(202, {
        projectId: pathMatch.projectId,
        acceptedCount
      });
    }

    if (
      request.method === "GET" &&
      pathMatch?.kind === "scenario-results" &&
      pathMatch.projectId &&
      pathMatch.scenarioKey
    ) {
      const items = await store.getScenarioResults(
        pathMatch.projectId,
        pathMatch.scenarioKey
      );

      return writeJson(200, {
        projectId: pathMatch.projectId,
        scenarioKey: pathMatch.scenarioKey,
        items
      });
    }

    return writeJson(404, { error: "Route not found." });
  };
}

interface ProjectPathMatch {
  kind: "import" | "scenario-results";
  projectId: string;
  scenarioKey?: string | undefined;
}

function matchProjectPath(pathname: string): ProjectPathMatch | null {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (
    segments.length === 5 &&
    segments[0] === "api" &&
    segments[1] === "projects" &&
    segments[3] === "import" &&
    segments[4] === "ndjson"
  ) {
    return {
      kind: "import",
      projectId: segments[2] ?? ""
    };
  }

  if (
    segments.length === 6 &&
    segments[0] === "api" &&
    segments[1] === "projects" &&
    segments[3] === "scenarios" &&
    segments[5] === "results"
  ) {
    return {
      kind: "scenario-results",
      projectId: segments[2] ?? "",
      scenarioKey: segments[4]
    };
  }

  return null;
}

function writeJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
