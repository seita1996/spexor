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
          browsers: ["chrome"],
          platforms: ["mac"],
          tags: ["auth"],
          priority: "high",
          owner: "qa@example.com",
          related: [],
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

    const saved = database.recordScenarioRun({
      scenarioKey: scenarios[0]!.scenarioKey,
      featureKey: parsed.relativePath,
      testerName: "qa@example.com",
      status: "passed",
      notes: "happy path",
      attachments: [{ kind: "file", value: "/tmp/screenshot.png", label: "desktop" }]
    });

    expect(saved.status).toBe("passed");
    expect(saved.attachments).toHaveLength(1);

    const history = database.getScenarioRunHistory(scenarios[0]!.scenarioKey);
    expect(history).toHaveLength(1);
    expect(history[0]?.testerName).toBe("qa@example.com");

    database.close();
  });
});
