import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ParsedSpecFile } from "@spexor/domain";
import { initDatabase } from "./index";

describe("@spexor/db", () => {
  it("rebuilds pre-snapshot databases at schema version 3", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-db-v1-"));
    const dbPath = path.join(tempRoot, "spexor.db");
    const legacy = new DatabaseSync(dbPath);
    legacy.exec(`
      PRAGMA user_version = 2;
      CREATE TABLE spec_files (relative_path TEXT PRIMARY KEY);
      INSERT INTO spec_files VALUES ('legacy.feature');
    `);
    legacy.close();

    const database = initDatabase(dbPath);
    expect(database.getSpecFiles()).toEqual([]);
    database.upsertSharedSyncState({
      projectId: "migration-check",
      lastSyncAt: null,
      lastSyncError: null,
      lastAttemptAt: null
    });
    database.close();

    const migrated = new DatabaseSync(dbPath);
    const version = migrated.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    expect(version.user_version).toBe(3);
    migrated.close();

    const reopened = initDatabase(dbPath);
    expect(reopened.getSharedSyncState("migration-check")?.projectId).toBe(
      "migration-check"
    );
    reopened.close();
  });

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
        id: "authentication.login",
        identity: {
          id: "authentication.login",
          source: "explicit",
          stable: true
        },
        filePath: path.join(tempRoot, "specs/manual/login.feature"),
        relativePath: "specs/manual/login.feature",
        title: "User login",
        description: "",
        metadata: {
          id: "authentication.login",
          title: "Login",
          lifecycle: "active",
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
            id: "authentication.login.valid-credentials",
            identity: {
              id: "authentication.login.valid-credentials",
              source: "explicit",
              stable: true
            },
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

    const scenarios = database.getFeatureScenarios(
      parsed.feature?.id ?? parsed.relativePath
    );
    expect(scenarios).toHaveLength(1);
    const [scenario] = scenarios;
    if (!scenario) {
      throw new Error("Expected a saved scenario.");
    }

    const saved = database.recordScenarioRun({
      scenarioKey: scenario.scenarioKey,
      featureKey: parsed.feature?.id ?? "",
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
      gitContext: {
        available: true,
        repositoryRoot: tempRoot,
        branch: "main",
        commitSha: "a".repeat(40),
        dirty: false,
        capturedAt: "2026-07-17T00:00:00.000Z"
      },
      items: [
        {
          scenarioKey: scenario.scenarioKey,
          featureKey: parsed.feature?.id ?? "",
          featureTitle: "Login",
          scenarioTitle: "Login with valid credentials",
          stepsSnapshot: [
            { keyword: "Given", text: "I open the login page" },
            { keyword: "Then", text: "I should see the dashboard" }
          ],
          environmentsSnapshot: ["mac-chrome"],
          specHash: scenario.specHash,
          sourceLine: 10,
          sortOrder: 1
        }
      ]
    });

    expect(session.totalCount).toBe(1);
    expect(session.status).toBe("active");
    expect(JSON.parse(session.gitContextJson)).toMatchObject({
      branch: "main",
      dirty: false
    });

    database.linkSessionScenarioResult(session.id, scenario.scenarioKey, saved);

    const sessions = database.getExecutionSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.resolvedCount).toBe(1);
    expect(sessions[0]?.status).toBe("completed");

    const sessionItems = database.getExecutionSessionItems(session.id);
    expect(sessionItems).toHaveLength(1);
    expect(sessionItems[0]?.resolvedStatus).toBe("passed");
    expect(sessionItems[0]?.latestRunResultId).toBe(saved.id);
    expect(JSON.parse(sessionItems[0]?.stepsSnapshotJson ?? "[]")).toHaveLength(
      2
    );
    expect(sessionItems[0]?.isCurrentSpecAvailable).toBe(true);
    expect(sessionItems[0]?.isStale).toBe(false);

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

    if (!parsed.feature) {
      throw new Error("Expected parsed feature.");
    }
    parsed.relativePath = "specs/manual/auth/login.feature";
    parsed.filePath = path.join(tempRoot, parsed.relativePath);
    parsed.feature.relativePath = parsed.relativePath;
    parsed.feature.filePath = parsed.filePath;
    parsed.feature.title = "Renamed user login";
    parsed.feature.scenarios[0]!.title = "Renamed login scenario";
    database.saveParsedSpecs([parsed]);

    expect(database.getFeature("authentication.login")?.specRelativePath).toBe(
      "specs/manual/auth/login.feature"
    );
    expect(
      database.getScenarioRunHistory("authentication.login.valid-credentials")
    ).toHaveLength(1);
    expect(database.getExecutionSessionItems(session.id)[0]?.isStale).toBe(
      true
    );

    database.saveParsedSpecs([]);
    const deletedSpecItem = database.getExecutionSessionItems(session.id)[0];
    expect(deletedSpecItem?.isCurrentSpecAvailable).toBe(false);
    expect(deletedSpecItem?.isStale).toBe(true);
    expect(deletedSpecItem?.scenarioTitle).toBe("Login with valid credentials");

    database.close();
  });
});
