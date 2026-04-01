import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ParsedSpecFile } from "@spexor/domain";
import { initDatabase } from "./index";

describe("@spexor/db", () => {
  it("initializes SQLite and persists scenario run history", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-db-"));
    const dbPath = path.join(tempRoot, ".spexor", "spexor.db");
    const database = initDatabase(dbPath);

    const parsed: ParsedSpecFile = {
      filePath: path.join(tempRoot, "specs/manual/login.feature"),
      relativePath: "specs/manual/login.feature",
      contentHash: "demo-hash",
      issues: [],
      parseHealth: "ok",
      feature: {
        id: "specs/manual/login.feature",
        filePath: path.join(tempRoot, "specs/manual/login.feature"),
        relativePath: "specs/manual/login.feature",
        title: "User login",
        description: "",
        metadata: {
          title: "Login",
          environments: ["mac-chrome"],
          tags: ["auth"],
          priority: "high",
          owner: "qa@example.com",
          related: [],
          verification: {
            manualOnly: true,
            automated: []
          },
          extra: {}
        },
        background: [],
        scenarios: [
          {
            id: "specs/manual/login.feature::login-with-valid-credentials::1",
            title: "Login with valid credentials",
            description: "",
            kind: "scenario",
            tags: ["auth"],
            steps: [
              {
                keyword: "Given",
                text: "I open the login page"
              },
              {
                keyword: "Then",
                text: "I should see the dashboard"
              }
            ],
            examples: []
          }
        ]
      }
    };

    database.saveParsedSpecs([parsed]);

    const overview = database.getSpecsOverview();
    expect(overview).toHaveLength(1);
    expect(overview[0]?.scenarioCount).toBe(1);

    const scenarios = database.getFeatureScenarios(parsed.relativePath);
    expect(scenarios).toHaveLength(1);
    const [scenario] = scenarios;
    if (!scenario) {
      throw new Error("Expected a saved scenario.");
    }

    const saved = database.recordScenarioRun({
      scenarioKey: scenario.scenarioKey,
      featureKey: parsed.relativePath,
      testerName: "qa@example.com",
      status: "passed",
      notes: "happy path",
      attachments: [
        { kind: "file", value: "/tmp/screenshot.png", label: "desktop" }
      ]
    });

    expect(saved.status).toBe("passed");
    expect(saved.attachments).toHaveLength(1);

    const history = database.getScenarioRunHistory(scenario.scenarioKey);
    expect(history).toHaveLength(1);
    expect(history[0]?.testerName).toBe("qa@example.com");

    const session = database.createExecutionSession({
      name: "Auth smoke",
      filtersJson: JSON.stringify({
        search: "",
        tag: "auth",
        environment: "",
        priority: "high"
      }),
      items: [
        {
          scenarioKey: scenario.scenarioKey,
          featureKey: parsed.relativePath,
          featureTitle: "Login",
          scenarioTitle: "Login with valid credentials",
          sourceLine: 10,
          sortOrder: 1
        }
      ]
    });

    expect(session.totalCount).toBe(1);
    expect(session.status).toBe("active");

    database.linkSessionScenarioResult(session.id, scenario.scenarioKey, saved);

    const sessions = database.getExecutionSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.resolvedCount).toBe(1);
    expect(sessions[0]?.status).toBe("completed");

    const sessionItems = database.getExecutionSessionItems(session.id);
    expect(sessionItems).toHaveLength(1);
    expect(sessionItems[0]?.resolvedStatus).toBe("passed");
    expect(sessionItems[0]?.latestRunResultId).toBe(saved.id);

    const syncState = database.upsertSharedSyncState({
      projectId: "qa-console",
      lastSyncAt: "2026-03-31T00:00:00.000Z",
      lastSyncError: null,
      lastAttemptAt: "2026-03-31T00:00:00.000Z"
    });
    expect(syncState.projectId).toBe("qa-console");
    expect(database.getSharedSyncState("qa-console")?.lastSyncAt).toBe(
      "2026-03-31T00:00:00.000Z"
    );

    database.close();
  });
});
