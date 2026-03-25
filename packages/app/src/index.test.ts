import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSpexorApp } from "./index";

describe("@spexor/app", () => {
  it("syncs specs, returns detail DTOs, and records history", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-app-"));
    await fs.mkdir(path.join(tempRoot, "specs/manual"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, "spexor.config.ts"),
      `export default {
        specDir: "./specs/manual",
        dbPath: "./.spexor/test.db",
        evidenceDir: "./.spexor/evidence",
        autoScan: false
      };`,
      "utf8"
    );
    await fs.writeFile(
      path.join(tempRoot, "specs/manual/login.feature"),
      `---
title: Login
browsers:
  - chrome
platforms:
  - mac
tags:
  - auth
priority: high
---

Feature: User login

  Scenario: Login with valid credentials
    Given I open the login page
    Then I should see the dashboard
`,
      "utf8"
    );

    const app = await createSpexorApp({ rootDir: tempRoot });

    const list = await app.getSpecsList();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("Login");

    const detail = await app.getFeatureDetail(list[0]!.featureId);
    expect(detail?.scenarioGroups).toHaveLength(1);

    const scenarioId = detail!.scenarioGroups[0]!.cases[0]!.id;
    await app.recordScenarioResult(scenarioId, {
      testerName: "qa@example.com",
      status: "failed",
      notes: "reproducible issue",
      attachments: [{ kind: "url", value: "https://example.com/log", label: "log" }]
    });

    const history = await app.getScenarioHistory(scenarioId);
    expect(history?.history[0]?.status).toBe("failed");
    expect(history?.history[0]?.attachments[0]?.kind).toBe("url");

    await app.close();
  });
});
