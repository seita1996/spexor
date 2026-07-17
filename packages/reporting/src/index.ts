import type {
  EvidenceRef,
  GitContext,
  RunStatus,
  StepSpec
} from "@spexor/domain";

export type RunReportFormat = "markdown" | "json" | "junit";

export interface VerificationRunReport {
  schemaVersion: 1;
  exportedAt: string;
  run: {
    id: string;
    baseRunId: string | null;
    name: string;
    status: "active" | "completed";
    createdAt: string;
    completedAt: string | null;
    gitContext: GitContext;
    filters: Record<string, unknown>;
  };
  summary: {
    total: number;
    resolved: number;
    passed: number;
    failed: number;
    blocked: number;
    skipped: number;
    notRun: number;
    stale: number;
    evidence: number;
  };
  scenarios: VerificationRunReportScenario[];
}

export interface VerificationRunReportScenario {
  scenarioId: string;
  featureId: string;
  featureTitle: string;
  scenarioTitle: string;
  sourceLine: number | null;
  steps: StepSpec[];
  environments: string[];
  specHash: string;
  status: RunStatus | "not-run";
  isStale: boolean;
  isCurrentSpecAvailable: boolean;
  result: {
    id: string;
    testerName: string;
    environment?: string | undefined;
    notes: string;
    createdAt: string;
    attachments: EvidenceRef[];
  } | null;
}

export function formatVerificationRunReport(
  report: VerificationRunReport,
  format: RunReportFormat
): string {
  switch (format) {
    case "markdown":
      return formatMarkdown(report);
    case "json":
      return `${JSON.stringify(report, null, 2)}\n`;
    case "junit":
      return formatJunit(report);
  }
}

function formatMarkdown(report: VerificationRunReport): string {
  const lines = [
    `# ${report.run.name}`,
    "",
    `- Run ID: \`${report.run.id}\``,
    `- Status: ${report.run.status}`,
    `- Created: ${report.run.createdAt}`,
    `- Completed: ${report.run.completedAt ?? "not completed"}`,
    `- Git: ${formatGit(report.run.gitContext)}`,
    ...(report.run.baseRunId
      ? [`- Retry of: \`${report.run.baseRunId}\``]
      : []),
    "",
    "## Summary",
    "",
    `| Total | Passed | Failed | Blocked | Skipped | Not run | Stale | Evidence |`,
    `| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |`,
    `| ${report.summary.total} | ${report.summary.passed} | ${report.summary.failed} | ${report.summary.blocked} | ${report.summary.skipped} | ${report.summary.notRun} | ${report.summary.stale} | ${report.summary.evidence} |`,
    "",
    "## Scenarios",
    ""
  ];

  for (const scenario of report.scenarios) {
    lines.push(
      `### ${statusMark(scenario.status)} ${scenario.scenarioTitle}`,
      "",
      `- Status: ${scenario.status}`,
      `- Feature: ${scenario.featureTitle} (\`${scenario.featureId}\`)`,
      `- Scenario ID: \`${scenario.scenarioId}\``,
      `- Environment: ${scenario.result?.environment ?? (scenario.environments.join(", ") || "not recorded")}`,
      `- Tester: ${scenario.result?.testerName ?? "not recorded"}`,
      `- Snapshot: \`${scenario.specHash}\`${scenario.isStale ? " (stale)" : ""}`,
      "",
      ...scenario.steps.map(
        (step) =>
          `- **${escapeMarkdown(step.keyword)}** ${escapeMarkdown(step.text)}`
      )
    );
    if (scenario.result?.notes) {
      lines.push("", `Notes: ${escapeMarkdown(scenario.result.notes)}`);
    }
    if ((scenario.result?.attachments.length ?? 0) > 0) {
      lines.push("", "Evidence:");
      for (const attachment of scenario.result?.attachments ?? []) {
        lines.push(
          `- ${attachment.kind}: ${escapeMarkdown(attachment.label ?? attachment.value)} — ${escapeMarkdown(attachment.value)}`
        );
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function formatJunit(report: VerificationRunReport): string {
  const failures = report.summary.failed;
  const skipped =
    report.summary.blocked + report.summary.skipped + report.summary.notRun;
  const durationSeconds = elapsedSeconds(
    report.run.createdAt,
    report.run.completedAt
  );
  const cases = report.scenarios.map((scenario) => {
    const properties = [
      `<property name="scenarioId" value="${xml(scenario.scenarioId)}"/>`,
      `<property name="specHash" value="${xml(scenario.specHash)}"/>`,
      `<property name="stale" value="${scenario.isStale}"/>`
    ].join("");
    const detail = scenario.result?.notes ?? "";
    const outcome =
      scenario.status === "failed"
        ? `<failure message="${xml(detail || "Scenario failed")}"/>`
        : scenario.status === "blocked" ||
            scenario.status === "skipped" ||
            scenario.status === "not-run"
          ? `<skipped message="${xml(scenario.status)}"/>`
          : "";
    const evidence = (scenario.result?.attachments ?? [])
      .map((attachment) => `${attachment.kind}: ${attachment.value}`)
      .join("\n");
    const output = [detail, evidence].filter(Boolean).join("\n");
    return `<testcase classname="${xml(scenario.featureTitle)}" name="${xml(scenario.scenarioTitle)}"><properties>${properties}</properties>${outcome}${output ? `<system-out>${xml(output)}</system-out>` : ""}</testcase>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="${report.summary.total}" failures="${failures}" skipped="${skipped}" time="${durationSeconds}"><testsuite name="${xml(report.run.name)}" tests="${report.summary.total}" failures="${failures}" skipped="${skipped}" time="${durationSeconds}">${cases.join("")}</testsuite></testsuites>\n`;
}

function formatGit(context: GitContext): string {
  if (!context.available) {
    return "unavailable";
  }
  return `${context.branch ?? "detached"} @ ${context.commitSha ?? "unknown"}${context.dirty ? " (dirty)" : ""}`;
}

function elapsedSeconds(createdAt: string, completedAt: string | null): string {
  if (!completedAt) {
    return "0";
  }
  const milliseconds = Date.parse(completedAt) - Date.parse(createdAt);
  return Number.isFinite(milliseconds)
    ? String(Math.max(0, milliseconds / 1000))
    : "0";
}

function statusMark(status: RunStatus | "not-run"): string {
  return {
    passed: "✅",
    failed: "❌",
    blocked: "⛔",
    skipped: "⏭️",
    "not-run": "⬜"
  }[status];
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[\]()#+.!|>~-])/g, "\\$1");
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;");
}
