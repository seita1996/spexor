import type { ExecutionSessionDetailDto } from "@spexor/app";
import { ExecutionSessionItemsList, StatusBadge } from "@spexor/ui";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ScenarioExecutionPanel } from "../components/ScenarioExecutionPanel";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import { getExecutionSession, saveSessionScenarioRun } from "../lib/api";

export function ExecutionSessionPage() {
  const params = useParams();
  const sessionId = params["sessionId"] ?? "";
  const [detail, setDetail] = useState<ExecutionSessionDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [sessionTesterName, setSessionTesterName] = useState("");
  const [sessionEnvironment, setSessionEnvironment] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const nextDetail = await getExecutionSession(sessionId);
        if (!cancelled) {
          setDetail(nextDetail);
          setError(null);
          setActiveScenarioId(
            nextDetail.nextScenarioId ?? nextDetail.items[0]?.scenarioId ?? null
          );
          const defaults = loadSessionDefaults(nextDetail.id);
          const availableEnvironments =
            getSessionEnvironmentOptions(nextDetail);
          setSessionTesterName(defaults.testerName ?? "");
          setSessionEnvironment(
            defaults.environment &&
              availableEnvironments.includes(defaults.environment)
              ? defaults.environment
              : (availableEnvironments[0] ?? "")
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load execution session."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const activeItem = useMemo(
    () =>
      detail?.items.find((item) => item.scenarioId === activeScenarioId) ??
      detail?.items[0] ??
      null,
    [activeScenarioId, detail]
  );
  const activeSteps = activeItem?.steps ?? [];
  const environmentOptions = useMemo(
    () => getSessionEnvironmentOptions(detail),
    [detail]
  );
  const activeItemSupportsEnvironment =
    !activeItem ||
    !sessionEnvironment ||
    activeItem.environments.includes(sessionEnvironment);

  useEffect(() => {
    if (!detail) {
      return;
    }

    saveSessionDefaults(detail.id, {
      testerName: sessionTesterName,
      environment: sessionEnvironment
    });
  }, [detail, sessionEnvironment, sessionTesterName]);

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">
        Loading execution session...
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="grid gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-sm text-rose-800 dark:text-rose-200">
        <p>{error ?? "Execution session not found."}</p>
        <div>
          <Link to="/">
            <Button variant="outline">Back to specs</Button>
          </Link>
        </div>
      </section>
    );
  }

  const completionRate =
    detail.totalCount === 0
      ? 0
      : Math.round((detail.resolvedCount / detail.totalCount) * 100);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/">
          <Button
            variant="ghost"
            className="px-0 uppercase tracking-[0.18em] text-muted-foreground"
          >
            Back to specs
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={detail.status === "completed" ? "passed" : "not-run"}
          />
          <span className="text-sm text-muted-foreground">
            {detail.status === "completed" ? "Completed" : "Active session"}
          </span>
        </div>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardContent className="grid gap-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Execution session
              </div>
              <h1 className="text-3xl font-semibold text-foreground">
                {detail.name}
              </h1>
              <div className="text-sm text-muted-foreground">
                {detail.resolvedCount} / {detail.totalCount} scenarios resolved
              </div>
            </div>

            <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
              <div className="text-xs uppercase tracking-[0.22em] text-primary-foreground/75">
                Progress
              </div>
              <div className="mt-2 text-3xl font-semibold">
                {completionRate}%
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Filter snapshot
              </div>
              <div className="mt-2 text-sm text-foreground">
                {summarizeFilters(detail)}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Next scenario
              </div>
              <div className="mt-2 text-sm text-foreground">
                {detail.nextScenarioId
                  ? (detail.items.find(
                      (item) => item.scenarioId === detail.nextScenarioId
                    )?.scenarioTitle ?? "Ready to continue")
                  : "All scenarios resolved"}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Session status
              </div>
              <div className="mt-2 text-sm text-foreground">
                {detail.status === "completed"
                  ? "Progress is complete. Re-runs still update the latest local result."
                  : "Select a scenario, run it, and keep moving down the session."}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-muted/25 p-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-foreground">
              Session tester or developer
              <input
                className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                value={sessionTesterName}
                onChange={(event) => setSessionTesterName(event.target.value)}
                placeholder="Your name or email"
              />
            </label>
            <label className="grid gap-2 text-sm text-foreground">
              Session environment
              <select
                className="h-10 rounded-lg border border-input bg-background px-3 py-2 outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                value={sessionEnvironment}
                onChange={(event) => setSessionEnvironment(event.target.value)}
                disabled={environmentOptions.length === 0}
              >
                {environmentOptions.length === 0 ? (
                  <option value="">No environment options</option>
                ) : null}
                {environmentOptions.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-lg">Session checklist</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ExecutionSessionItemsList
              items={detail.items.map((item) => ({
                scenarioId: item.scenarioId,
                featureTitle: item.featureTitle,
                scenarioTitle: item.scenarioTitle,
                featureId: item.featureId,
                sourceLine: item.sourceLine ?? null,
                latestStatus:
                  item.resolvedStatus ?? item.latestResult?.status ?? null,
                latestTesterName: item.latestResult?.testerName,
                isStale: item.isStale,
                isSelected: item.scenarioId === activeItem?.scenarioId
              }))}
              onSelect={(nextScenarioId) => {
                setActiveScenarioId(nextScenarioId);
                setSaveError(null);
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <CardTitle className="text-lg">Record result</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activeItem ? (
              activeItem.isStale ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-5 text-sm text-amber-900 dark:text-amber-200">
                  This scenario is no longer active in the latest scan. Open the
                  source feature and refresh the session target set before
                  recording a new result.
                </div>
              ) : !activeItemSupportsEnvironment ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-5 text-sm text-amber-900 dark:text-amber-200">
                  The selected session environment does not match this scenario.
                  Choose one of the scenario environments before recording a
                  result.
                </div>
              ) : (
                <div className="grid gap-5">
                  <section className="grid gap-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Scenario steps
                    </div>
                    {activeSteps.length > 0 ? (
                      <ol className="grid gap-2">
                        {activeSteps.map((step, index) => (
                          <li
                            key={`${activeItem.scenarioId}-step-${index + 1}`}
                            className="rounded-lg border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground"
                          >
                            <span className="mr-2 font-semibold text-foreground">
                              {step.keyword}
                            </span>
                            {step.text}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Steps are unavailable for this scenario. Open the
                        feature detail page if you need to inspect the latest
                        parsed spec.
                      </div>
                    )}
                  </section>

                  <ScenarioExecutionPanel
                    key={`${detail.id}-${activeItem.scenarioId}`}
                    scenarioId={activeItem.scenarioId}
                    scenarioTitle={activeItem.scenarioTitle}
                    environments={activeItem.environments}
                    fixedTesterName={sessionTesterName}
                    fixedEnvironment={sessionEnvironment}
                    showTesterNameField={false}
                    showEnvironmentField={false}
                    isSaving={saving}
                    saveError={saveError}
                    resetOnSubmit
                    onSubmit={async (payload) => {
                      try {
                        setSaving(true);
                        setSaveError(null);
                        if (!sessionTesterName.trim()) {
                          throw new Error(
                            "Session tester or developer is required."
                          );
                        }
                        if (
                          environmentOptions.length > 0 &&
                          !sessionEnvironment
                        ) {
                          throw new Error("Session environment is required.");
                        }
                        if (
                          sessionEnvironment &&
                          !activeItem.environments.includes(sessionEnvironment)
                        ) {
                          throw new Error(
                            "The selected session environment does not match this scenario."
                          );
                        }
                        await saveSessionScenarioRun(
                          detail.id,
                          activeItem.scenarioId,
                          payload
                        );
                        const nextDetail = await getExecutionSession(detail.id);
                        setDetail(nextDetail);
                        setActiveScenarioId(
                          nextDetail.nextScenarioId ??
                            nextDetail.items.find(
                              (item) =>
                                item.scenarioId === activeItem.scenarioId
                            )?.scenarioId ??
                            nextDetail.items[0]?.scenarioId ??
                            null
                        );
                      } catch (submitError) {
                        setSaveError(
                          submitError instanceof Error
                            ? submitError.message
                            : "Failed to save run."
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  />
                </div>
              )
            ) : (
              <div className="rounded-xl border border-border bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
                No scenarios are available in this session.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function getSessionEnvironmentOptions(
  detail: ExecutionSessionDetailDto | null
): string[] {
  if (!detail) {
    return [];
  }

  return [
    ...new Set(
      detail.items.flatMap((item) => item.environments).filter(Boolean)
    )
  ];
}

function sessionDefaultsStorageKey(sessionId: string): string {
  return `spexor.execution-session-defaults:${sessionId}`;
}

function loadSessionDefaults(sessionId: string): {
  testerName?: string;
  environment?: string;
} {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      sessionDefaultsStorageKey(sessionId)
    );
    return raw
      ? (JSON.parse(raw) as { testerName?: string; environment?: string })
      : {};
  } catch {
    return {};
  }
}

function saveSessionDefaults(
  sessionId: string,
  value: { testerName: string; environment: string }
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    sessionDefaultsStorageKey(sessionId),
    JSON.stringify(value)
  );
}

function summarizeFilters(detail: ExecutionSessionDetailDto): string {
  const labels = [
    detail.filters.search.trim() && `search "${detail.filters.search.trim()}"`,
    detail.filters.tag && `tag ${detail.filters.tag}`,
    detail.filters.environment && `environment ${detail.filters.environment}`,
    detail.filters.priority && `priority ${detail.filters.priority}`
  ].filter(Boolean);

  if (labels.length === 0) {
    const featureIds = [...new Set(detail.items.map((item) => item.featureId))];
    if (featureIds.length === 1) {
      return `Feature session for ${detail.items[0]?.featureTitle ?? featureIds[0]}`;
    }
  }

  return labels.length > 0 ? labels.join(", ") : "No filters";
}
