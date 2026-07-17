import { describe, expect, it } from "vitest";
import {
  formatVerificationRunReport,
  type VerificationRunReport
} from "./index";

const report: VerificationRunReport = {
  schemaVersion: 1,
  exportedAt: "2026-07-17T01:00:00.000Z",
  run: {
    id: "run-1",
    baseRunId: null,
    name: "Authentication regression",
    status: "completed",
    createdAt: "2026-07-17T00:00:00.000Z",
    completedAt: "2026-07-17T00:01:00.000Z",
    gitContext: {
      available: true,
      repositoryRoot: "/workspace",
      branch: "main",
      commitSha: "a".repeat(40),
      dirty: false,
      capturedAt: "2026-07-17T00:00:00.000Z"
    },
    filters: {}
  },
  summary: {
    total: 1,
    resolved: 1,
    passed: 0,
    failed: 1,
    blocked: 0,
    skipped: 0,
    notRun: 0,
    stale: 1,
    evidence: 1
  },
  scenarios: [
    {
      scenarioId: "authentication.login.invalid",
      featureId: "authentication.login",
      featureTitle: "Login",
      scenarioTitle: "Reject invalid <credentials>",
      sourceLine: 12,
      steps: [{ keyword: "Then", text: "access is denied" }],
      environments: ["mac-chrome"],
      specHash: "b".repeat(64),
      status: "failed",
      isStale: true,
      isCurrentSpecAvailable: true,
      result: {
        id: "result-1",
        testerName: "qa@example.com",
        environment: "mac-chrome",
        notes: "Expected <401> & received 500",
        createdAt: "2026-07-17T00:01:00.000Z",
        attachments: [
          { kind: "url", value: "https://example.com/log", label: "log" }
        ]
      }
    }
  ]
};

describe("@spexor/reporting", () => {
  it("formats reviewable Markdown", () => {
    const markdown = formatVerificationRunReport(report, "markdown");
    expect(markdown).toContain("# Authentication regression");
    expect(markdown).toContain("❌ Reject invalid");
    expect(markdown).toContain("Evidence:");
  });

  it("formats stable JSON", () => {
    const json = JSON.parse(formatVerificationRunReport(report, "json"));
    expect(json.schemaVersion).toBe(1);
    expect(json.scenarios[0].status).toBe("failed");
  });

  it("formats escaped JUnit XML", () => {
    const junit = formatVerificationRunReport(report, "junit");
    expect(junit).toContain('failures="1"');
    expect(junit).toContain("Reject invalid &lt;credentials&gt;");
    expect(junit).toContain("Expected &lt;401&gt; &amp; received 500");
  });
});
