import {
  buildSharedRunEvent,
  stringifySharedRunEventsNdjson,
  type SharedRunEvent
} from "@spexor/results";
import { createResultsHubHandler, type SharedResultsStore } from "./index";

class MemorySharedResultsStore implements SharedResultsStore {
  private readonly events = new Map<string, SharedRunEvent[]>();

  async ingest(projectId: string, events: SharedRunEvent[]): Promise<number> {
    const current = this.events.get(projectId) ?? [];
    this.events.set(projectId, [...current, ...events]);
    return events.length;
  }

  async getScenarioResults(
    projectId: string,
    scenarioKey: string
  ): Promise<SharedRunEvent[]> {
    return (this.events.get(projectId) ?? []).filter(
      (event) => event.scenarioKey === scenarioKey
    );
  }
}

describe("@spexor/results-hub", () => {
  it("ingests NDJSON exports and returns scenario results", async () => {
    const handler = createResultsHubHandler(new MemorySharedResultsStore());
    const ndjson = stringifySharedRunEventsNdjson([
      buildSharedRunEvent({
        eventId: "evt-1",
        projectId: "spexor",
        featureId: "specs/manual/login.feature",
        scenarioKey: "specs/manual/login.feature::login::1",
        scenarioTitle: "Login with valid credentials",
        runId: "run-1",
        testerName: "qa@example.com",
        status: "passed",
        notes: "smoke passed",
        createdAt: "2026-03-30T01:00:00.000Z",
        attachments: [],
        exportedAt: "2026-03-30T01:01:00.000Z"
      })
    ]);

    const importResponse = await handler(
      new Request("https://hub.example.com/api/projects/spexor/import/ndjson", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-ndjson"
        },
        body: ndjson
      })
    );

    expect(importResponse.status).toBe(202);

    const resultsResponse = await handler(
      new Request(
        "https://hub.example.com/api/projects/spexor/scenarios/specs%2Fmanual%2Flogin.feature%3A%3Alogin%3A%3A1/results"
      )
    );
    const payload = (await resultsResponse.json()) as {
      items: SharedRunEvent[];
    };

    expect(resultsResponse.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]?.testerName).toBe("qa@example.com");
  });
});
