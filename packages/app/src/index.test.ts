import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSpexorApp } from "./index";

describe("@spexor/app", () => {
  it("syncs specs, returns detail DTOs, and records history", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "spexor-app-"));
    await fs.mkdir(path.join(tempRoot, "specs/manual"), { recursive: true });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation((input, init) => {
        const url = typeof input === "string" ? input : input.toString();
        if (init?.method === "POST" && url.includes("/import/ndjson")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                projectId: "qa-console",
                acceptedCount: 2
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json"
                }
              }
            )
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              projectId: "qa-console",
              scenarioKey:
                "specs/manual/login.feature::login-with-valid-credentials::1",
              items: [
                {
                  version: 1,
                  eventId: "shared-1",
                  projectId: "qa-console",
                  featureId: "specs/manual/login.feature",
                  scenarioKey:
                    "specs/manual/login.feature::login-with-valid-credentials::1",
                  scenarioTitle: "Login with valid credentials",
                  runId: "shared-run-1",
                  testerName: "shared@example.com",
                  status: "passed",
                  notes: "shared history",
                  createdAt: "2026-03-30T00:00:00.000Z",
                  attachments: [],
                  source: {
                    kind: "spexor",
                    exportedAt: "2026-03-30T00:10:00.000Z"
                  }
                }
              ]
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
        );
      });
    vi.stubGlobal("fetch", fetchMock);
    await fs.writeFile(
      path.join(tempRoot, "spexor.config.ts"),
      `export default {
        specDir: "./specs/manual",
        dbPath: "./.spexor/test.db",
        evidenceDir: "./.spexor/evidence",
        autoScan: false,
        sharedResults: {
          baseUrl: "https://results.example.com",
          projectId: "qa-console"
        }
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

    const firstFeature = list[0];
    expect(firstFeature).toBeDefined();
    const detail = await app.getFeatureDetail(firstFeature?.featureId ?? "");
    expect(detail?.scenarioGroups).toHaveLength(1);

    const firstGroup = detail?.scenarioGroups[0];
    expect(firstGroup).toBeDefined();
    const firstCase = firstGroup?.cases[0];
    expect(firstCase).toBeDefined();
    const scenarioId = firstCase?.id ?? "";
    await app.recordScenarioResult(scenarioId, {
      testerName: "qa@example.com",
      status: "failed",
      notes: "reproducible issue",
      attachments: [
        { kind: "url", value: "https://example.com/log", label: "log" }
      ]
    });

    const history = await app.getScenarioHistory(scenarioId);
    expect(history?.history[0]?.status).toBe("failed");
    expect(history?.history[0]?.attachments[0]?.kind).toBe("url");
    expect(history?.sharedHistoryEnabled).toBe(true);
    expect(history?.sharedHistory[0]?.testerName).toBe("shared@example.com");
    expect(history?.delta.state).toBe("different");
    expect(history?.syncStatus.enabled).toBe(true);

    const session = await app.createExecutionSession({
      filters: {
        search: "",
        tag: "auth",
        browser: "chrome",
        priority: "high"
      }
    });
    expect(session.totalCount).toBe(1);
    expect(session.items[0]?.scenarioId).toBe(scenarioId);
    expect(session.items[0]?.browsers).toEqual(["chrome"]);

    await app.recordSessionScenarioResult(session.id, scenarioId, {
      testerName: "qa@example.com",
      status: "passed",
      notes: "rerun after fix"
    });

    const savedSession = await app.getExecutionSession(session.id);
    expect(savedSession?.resolvedCount).toBe(1);
    expect(savedSession?.status).toBe("completed");
    expect(savedSession?.items[0]?.resolvedStatus).toBe("passed");

    await expect(
      app.createExecutionSession({
        filters: {
          search: "missing",
          tag: "",
          browser: "",
          priority: ""
        }
      })
    ).rejects.toThrow("No scenarios matched the current filters.");

    const exported = await app.exportRunResultsNdjson();
    expect(exported.projectId).toBe("qa-console");
    expect(exported.itemCount).toBe(2);
    expect(exported.ndjson).toContain(`"testerName":"qa@example.com"`);

    const syncResult = await app.syncSharedResults();
    expect(syncResult.acceptedCount).toBeDefined();

    const syncStatus = await app.getSharedSyncStatus();
    expect(syncStatus.enabled).toBe(true);
    expect(syncStatus.lastSyncAt).toBeDefined();

    await app.close();
    vi.unstubAllGlobals();
  });

  it("stores sync errors without losing local history", async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "spexor-app-sync-")
    );
    await fs.mkdir(path.join(tempRoot, "specs/manual"), { recursive: true });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new Error("fetch failed"))
    );
    await fs.writeFile(
      path.join(tempRoot, "spexor.config.ts"),
      `export default {
        specDir: "./specs/manual",
        dbPath: "./.spexor/test.db",
        evidenceDir: "./.spexor/evidence",
        autoScan: false,
        sharedResults: {
          baseUrl: "https://results.example.com",
          projectId: "qa-console"
        }
      };`,
      "utf8"
    );
    await fs.writeFile(
      path.join(tempRoot, "specs/manual/login.feature"),
      `Feature: User login

  Scenario: Login with valid credentials
    Given I open the login page
    Then I should see the dashboard
`,
      "utf8"
    );

    const app = await createSpexorApp({ rootDir: tempRoot });
    const detail = await app.getFeatureDetail("specs/manual/login.feature");
    const scenarioId = detail?.scenarioGroups[0]?.cases[0]?.id ?? "";
    await app.recordScenarioResult(scenarioId, {
      testerName: "qa@example.com",
      status: "passed"
    });

    await expect(app.syncSharedResults()).rejects.toThrow("fetch failed");
    const history = await app.getScenarioHistory(scenarioId);
    expect(history?.history).toHaveLength(1);
    expect(history?.syncStatus.lastSyncError).toBe("fetch failed");
    expect(history?.syncStatus.offlineLike).toBe(true);

    await app.close();
    vi.unstubAllGlobals();
  });
});
