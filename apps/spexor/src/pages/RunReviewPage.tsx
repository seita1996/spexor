import type {
  RunStatus,
  VerificationRunReport,
  VerificationRunReportScenario
} from "@spexor/app";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { getVerificationRunReport } from "../lib/api";

interface ReviewFilters {
  status: RunStatus | "not-run" | "";
  tester: string;
  feature: string;
  environment: string;
  stale: "" | "stale" | "current";
  evidence: "" | "with" | "without";
}

const initialFilters: ReviewFilters = {
  status: "",
  tester: "",
  feature: "",
  environment: "",
  stale: "",
  evidence: ""
};

export function RunReviewPage() {
  const { runId = "" } = useParams();
  const [report, setReport] = useState<VerificationRunReport | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getVerificationRunReport(runId)
      .then((nextReport) => {
        if (!cancelled) {
          setReport(nextReport);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load Run review."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const visibleScenarios = useMemo(
    () =>
      report?.scenarios.filter((scenario) =>
        matchesReviewFilters(scenario, filters)
      ) ?? [],
    [filters, report]
  );
  const testers = unique(
    report?.scenarios.flatMap((scenario) =>
      scenario.result?.testerName ? [scenario.result.testerName] : []
    ) ?? []
  );
  const features = unique(
    report?.scenarios.map((scenario) => scenario.featureTitle) ?? []
  );
  const environments = unique(
    report?.scenarios.flatMap((scenario) =>
      scenario.result?.environment
        ? [scenario.result.environment]
        : scenario.environments
    ) ?? []
  );

  if (loading) {
    return <ReviewState>Loading Run review...</ReviewState>;
  }
  if (error || !report) {
    return <ReviewState tone="error">{error ?? "Run not found."}</ReviewState>;
  }

  return (
    <main className="h-full overflow-y-auto bg-muted/20 p-4 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="grid gap-4 rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{report.run.name}</h1>
                <Badge variant="secondary">{report.run.status}</Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {report.run.id}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatReportGit(report)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton to={`/runs/${encodeURIComponent(report.run.id)}`}>
                Open Run
              </LinkButton>
              {(["markdown", "json", "junit"] as const).map((format) => (
                <a
                  key={format}
                  href={`/api/runs/${encodeURIComponent(report.run.id)}/export?format=${format}`}
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
                  download
                >
                  {format}
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {Object.entries(report.summary).map(([label, value]) => (
              <div key={label} className="rounded-md bg-muted/50 p-2">
                <div className="text-lg font-semibold">{value}</div>
                <div className="text-xs capitalize text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </header>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Review filters</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setFilters(initialFilters)}
            >
              Reset
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReviewSelect
              label="Status"
              value={filters.status}
              options={["passed", "failed", "blocked", "skipped", "not-run"]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  status: value as ReviewFilters["status"]
                }))
              }
            />
            <ReviewSelect
              label="Tester"
              value={filters.tester}
              options={testers}
              onChange={(tester) =>
                setFilters((current) => ({ ...current, tester }))
              }
            />
            <ReviewSelect
              label="Feature"
              value={filters.feature}
              options={features}
              onChange={(feature) =>
                setFilters((current) => ({ ...current, feature }))
              }
            />
            <ReviewSelect
              label="Environment"
              value={filters.environment}
              options={environments}
              onChange={(environment) =>
                setFilters((current) => ({ ...current, environment }))
              }
            />
            <ReviewSelect
              label="Snapshot"
              value={filters.stale}
              options={["stale", "current"]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  stale: value as ReviewFilters["stale"]
                }))
              }
            />
            <ReviewSelect
              label="Evidence"
              value={filters.evidence}
              options={["with", "without"]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  evidence: value as ReviewFilters["evidence"]
                }))
              }
            />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {visibleScenarios.length} of {report.scenarios.length} Scenarios
          </span>
          <span>
            Export CLI: npx spexor export run {report.run.id} --format junit
          </span>
        </div>

        <div className="grid gap-3">
          {visibleScenarios.length === 0 ? (
            <ReviewState>No Scenarios match these review filters.</ReviewState>
          ) : null}
          {visibleScenarios.map((scenario) => (
            <ScenarioReviewCard key={scenario.scenarioId} scenario={scenario} />
          ))}
        </div>
      </div>
    </main>
  );
}

function ScenarioReviewCard(props: {
  scenario: VerificationRunReportScenario;
}) {
  const { scenario } = props;
  return (
    <Card>
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {scenario.scenarioTitle}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {scenario.featureTitle} · {scenario.scenarioId}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge
              variant={scenario.status === "failed" ? "destructive" : "outline"}
            >
              {scenario.status}
            </Badge>
            {scenario.isStale ? <Badge variant="outline">stale</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0">
        <ol className="grid gap-1 text-sm">
          {scenario.steps.map((step, index) => (
            <li key={`${step.keyword}-${index + 1}`}>
              <span className="font-medium">{step.keyword}</span> {step.text}
            </li>
          ))}
        </ol>
        <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Tester</dt>
            <dd>{scenario.result?.testerName ?? "not recorded"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Environment</dt>
            <dd>
              {scenario.result?.environment ??
                (scenario.environments.join(", ") || "not recorded")}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Evidence</dt>
            <dd>{scenario.result?.attachments.length ?? 0} refs</dd>
          </div>
        </dl>
        {scenario.result?.notes ? (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            {scenario.result.notes}
          </div>
        ) : null}
        {(scenario.result?.attachments.length ?? 0) > 0 ? (
          <ul className="grid gap-1 text-sm">
            {scenario.result?.attachments.map((attachment) => (
              <li key={`${attachment.kind}-${attachment.value}`}>
                <span className="font-medium">
                  {attachment.label ?? attachment.kind}:
                </span>{" "}
                {attachment.value}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function matchesReviewFilters(
  scenario: VerificationRunReportScenario,
  filters: ReviewFilters
): boolean {
  const evidenceCount = scenario.result?.attachments.length ?? 0;
  return (
    (!filters.status || scenario.status === filters.status) &&
    (!filters.tester || scenario.result?.testerName === filters.tester) &&
    (!filters.feature || scenario.featureTitle === filters.feature) &&
    (!filters.environment ||
      scenario.result?.environment === filters.environment ||
      scenario.environments.includes(filters.environment)) &&
    (!filters.stale ||
      (filters.stale === "stale" ? scenario.isStale : !scenario.isStale)) &&
    (!filters.evidence ||
      (filters.evidence === "with" ? evidenceCount > 0 : evidenceCount === 0))
  );
}

function ReviewSelect(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {props.label}
      <select
        aria-label={`Review filter: ${props.label}`}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
      >
        <option value="">All</option>
        {props.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LinkButton(props: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={props.to}
      className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
    >
      {props.children}
    </Link>
  );
}

function ReviewState(props: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={
        props.tone === "error"
          ? "m-6 rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-800 dark:text-rose-200"
          : "m-6 rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground"
      }
    >
      {props.children}
    </div>
  );
}

function formatReportGit(report: VerificationRunReport): string {
  const git = report.run.gitContext;
  if (!git.available) {
    return "Git context unavailable";
  }
  return `${git.branch ?? "detached"} @ ${git.commitSha?.slice(0, 8) ?? "unknown"}${git.dirty ? " · dirty worktree" : ""}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
