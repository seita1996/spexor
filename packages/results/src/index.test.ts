import {
  buildSharedRunEvent,
  defaultProjectId,
  parseSharedRunEventsNdjson,
  stringifySharedRunEventsNdjson
} from "./index";

describe("@spexor/results", () => {
  it("serializes and parses shared run events as NDJSON", () => {
    const event = buildSharedRunEvent({
      eventId: "evt-1",
      projectId: "spexor-demo",
      featureId: "specs/manual/login.feature",
      scenarioKey: "specs/manual/login.feature::login::1",
      scenarioTitle: "Login",
      runId: "run-1",
      testerName: "qa@example.com",
      status: "passed",
      notes: "looks good",
      createdAt: "2026-03-30T00:00:00.000Z",
      attachments: [{ kind: "url", value: "https://example.com/evidence.png" }],
      exportedAt: "2026-03-30T00:10:00.000Z"
    });

    const ndjson = stringifySharedRunEventsNdjson([event]);
    const parsed = parseSharedRunEventsNdjson(ndjson);

    expect(parsed).toEqual([event]);
  });

  it("derives a stable default project id from the root path", () => {
    expect(defaultProjectId("/Users/tahara/Documents/prj/spexor")).toBe(
      "spexor"
    );
    expect(defaultProjectId("/workspace/QA Console")).toBe("qa-console");
  });
});
