import type {
  ExecutionSessionFilters,
  FeatureDetailDto,
  ScenarioHistoryDto
} from "@spexor/app";
import {
  MetadataChips,
  ParseHealthBadge,
  RunHistoryList,
  ScenarioGroups,
  StatusBadge,
  statusToneStyles
} from "@spexor/ui";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { IssueList } from "../components/IssueList";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "../components/ui/dialog";
import {
  createExecutionSession,
  getFeature,
  getScenarioHistory,
  syncSharedResults
} from "../lib/api";

const emptyExecutionFilters: ExecutionSessionFilters = {
  search: "",
  tag: "",
  environment: "",
  priority: ""
};

export function FeatureDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const featureId = params["*"] ?? "";
  const [detail, setDetail] = useState<FeatureDetailDto | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryDto | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [syncingShared, setSyncingShared] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const result = await getFeature(featureId);
        if (!cancelled) {
          setDetail(result);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load feature."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (featureId) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [featureId]);

  const activeScenario = detail?.scenarioGroups
    .flatMap((group) => group.cases)
    .find((scenario) => scenario.id === activeScenarioId);

  const loadHistory = async (scenarioId: string) => {
    setHistoryLoading(true);
    try {
      const nextHistory = await getScenarioHistory(scenarioId);
      setHistory(nextHistory);
      setError(null);
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : "Failed to load history."
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const closePanel = () => {
    setActiveScenarioId(null);
    setSyncMessage(null);
    setHistory(null);
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card/80 px-5 py-10 text-center text-sm text-muted-foreground">
        Loading feature...
      </section>
    );
  }

  if (error && !detail) {
    return (
      <section className="grid gap-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-sm text-rose-800 dark:text-rose-200">
        <p>{error}</p>
        <div>
          <Link to="/">
            <Button variant="outline">Back to specs</Button>
          </Link>
        </div>
      </section>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <>
      <div className="grid gap-6">
        <div>
          <Link to="/">
            <Button
              variant="ghost"
              className="px-0 uppercase tracking-[0.18em] text-muted-foreground"
            >
              Back to specs
            </Button>
          </Link>
        </div>

        <Card className="border-border/70 bg-card/90">
          <CardContent className="grid gap-5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold text-foreground">
                    {detail.title}
                  </h1>
                  <ParseHealthBadge health={detail.parseHealth} />
                </div>
                <code className="text-sm text-muted-foreground">
                  {detail.filePath}
                </code>
                {detail.featureTitle && detail.featureTitle !== detail.title ? (
                  <div className="text-sm text-muted-foreground">
                    Feature: {detail.featureTitle}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
                  <div className="text-xs uppercase tracking-[0.22em] text-primary-foreground/75">
                    Scenario cases
                  </div>
                  <div className="mt-2 text-3xl font-semibold">
                    {detail.scenarioGroups.reduce(
                      (count, group) => count + group.cases.length,
                      0
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={startingSession}
                  className="uppercase tracking-[0.18em]"
                  onClick={async () => {
                    try {
                      setStartingSession(true);
                      const session = await createExecutionSession({
                        name: `Feature session: ${detail.title}`,
                        filters: emptyExecutionFilters,
                        scenarioIds: detail.scenarioGroups.flatMap((group) =>
                          group.cases.map((scenarioCase) => scenarioCase.id)
                        )
                      });
                      setError(null);
                      void navigate(`/sessions/${session.id}`);
                    } catch (sessionError) {
                      setError(
                        sessionError instanceof Error
                          ? sessionError.message
                          : "Failed to start execution session."
                      );
                    } finally {
                      setStartingSession(false);
                    }
                  }}
                >
                  {startingSession
                    ? "Starting session..."
                    : "Start session for this feature"}
                </Button>
              </div>
            </div>

            {detail.description ? (
              <p className="max-w-4xl text-sm leading-7 text-muted-foreground">
                {detail.description}
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <MetadataChips label="Tags" values={detail.metadata.tags} />
              <MetadataChips
                label="Environments"
                values={detail.metadata.environments}
              />
              <MetadataChips
                label="Related"
                values={detail.metadata.related}
                emptyLabel="no links"
              />
            </div>

            {detail.environmentStatuses.length > 0 ? (
              <section className="grid gap-3 rounded-xl border border-border bg-muted/25 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Latest by environment
                </div>
                <div className="flex flex-wrap gap-3">
                  {detail.environmentStatuses.map((item) => (
                    <div
                      key={item.environment}
                      className={`rounded-xl border px-4 py-3 ${statusToneStyles[item.aggregateStatus ?? "not-run"]}`}
                    >
                      <div className="text-sm font-semibold">
                        {item.environment}
                      </div>
                      <div className="text-xs uppercase tracking-[0.14em]">
                        {item.aggregateStatus ?? "not run"}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {detail.metadata.owner ? (
                <span>Owner: {detail.metadata.owner}</span>
              ) : null}
              {detail.metadata.priority ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-amber-900 dark:text-amber-200">
                  Priority: {detail.metadata.priority}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-xl border border-border bg-muted/35 p-4 md:grid-cols-3">
              <div className="grid gap-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 1
                </div>
                <div className="text-sm text-foreground">
                  Read the background and scenario steps to confirm what to
                  test.
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 2
                </div>
                <div className="text-sm text-foreground">
                  Open History when you need the previous result or tester
                  notes.
                </div>
              </div>
              <div className="grid gap-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Step 3
                </div>
                <div className="text-sm text-foreground">
                  Start a feature session to work through each case in order and
                  record outcomes there.
                </div>
              </div>
            </div>

            <IssueList issues={detail.issues} />
          </CardContent>
        </Card>

        {detail.background.length > 0 ? (
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="text-lg">Background</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="mt-4 grid gap-2">
                {detail.background.map((step, index) => (
                  <li
                    key={`background-step-${index + 1}`}
                    className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                  >
                    <span className="mr-2 font-semibold text-foreground">
                      {step.keyword}
                    </span>
                    {step.text}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ) : null}

        <ScenarioGroups
          groups={detail.scenarioGroups.map((group) => ({
            id: group.id,
            title: group.title,
            description: group.description,
            kind: group.kind,
            aggregateStatus: group.aggregateStatus,
            cases: group.cases.map((scenarioCase) => ({
              id: scenarioCase.id,
              title: scenarioCase.title,
              description: scenarioCase.description,
              kind: scenarioCase.kind,
              tags: scenarioCase.tags,
              steps: scenarioCase.steps,
              exampleName: scenarioCase.exampleName,
              exampleIndex: scenarioCase.exampleIndex,
              exampleValues: scenarioCase.exampleValues,
              latestStatus: scenarioCase.latestResult?.status ?? null,
              latestLabel: scenarioCase.latestResult?.testerName
            }))
          }))}
          onHistory={(scenarioId) => {
            setActiveScenarioId(scenarioId);
            void loadHistory(scenarioId);
          }}
        />
      </div>

      <Dialog
        open={Boolean(activeScenario)}
        onOpenChange={(open) => {
          if (!open) {
            closePanel();
          }
        }}
      >
        <DialogContent>
          {activeScenario ? (
            <div className="grid gap-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="grid gap-2">
                    <div className="flex items-center gap-3">
                      <StatusBadge
                        status={
                          activeScenario.latestResult?.status ?? "not-run"
                        }
                      />
                      <DialogTitle>{activeScenario.title}</DialogTitle>
                    </div>
                    <DialogDescription>
                      Review earlier runs for this scenario before recording a
                      new result.
                    </DialogDescription>
                  </div>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Close dialog"
                    >
                      Close
                    </Button>
                  </DialogClose>
                </div>
              </DialogHeader>

              {historyLoading ? (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                  Loading history...
                </div>
              ) : (
                <div className="grid gap-6">
                  <section className="grid gap-3 rounded-xl border border-border bg-muted/25 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Shared sync
                        </div>
                        <div className="text-sm text-foreground">
                          {history?.syncStatus.enabled
                            ? history.syncStatus.lastSyncError
                              ? "Sync failed. Local history is still available."
                              : history.syncStatus.lastSyncAt
                                ? `Connected to ${history.syncStatus.projectId}. Last synced ${new Date(
                                    history.syncStatus.lastSyncAt
                                  ).toLocaleString()}.`
                                : `Connected to ${history.syncStatus.projectId}. No sync yet.`
                            : "Local-only mode. Shared results are not configured."}
                        </div>
                      </div>
                      {history?.syncStatus.enabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={syncingShared}
                          onClick={async () => {
                            if (!activeScenario) {
                              return;
                            }
                            try {
                              setSyncingShared(true);
                              setSyncMessage(null);
                              await syncSharedResults();
                              const nextHistory = await getScenarioHistory(
                                activeScenario.id
                              );
                              setHistory(nextHistory);
                              setSyncMessage("Shared history updated.");
                            } catch (syncError) {
                              setSyncMessage(
                                syncError instanceof Error
                                  ? syncError.message
                                  : "Failed to sync shared results."
                              );
                            } finally {
                              setSyncingShared(false);
                            }
                          }}
                        >
                          {syncingShared ? "Syncing..." : "Sync now"}
                        </Button>
                      ) : null}
                    </div>

                    {history?.syncStatus.lastSyncError ? (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                        {history.syncStatus.lastSyncError}
                      </div>
                    ) : null}

                    {syncMessage ? (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
                        {syncMessage}
                      </div>
                    ) : null}
                  </section>

                  <section className="grid gap-3 rounded-xl border border-border bg-card/80 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Latest delta
                    </div>
                    <div className="rounded-lg border border-border bg-muted/35 px-4 py-3 text-sm text-foreground">
                      {history?.delta.summaryLabel}
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Local history
                      </div>
                      <RunHistoryList
                        items={history?.history ?? []}
                        emptyMessage="This scenario has not been executed locally yet."
                      />
                    </section>

                    <section className="grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Shared history
                      </div>

                      {history?.sharedHistoryEnabled ? (
                        <RunHistoryList
                          items={(history?.sharedHistory ?? []).map((item) => ({
                            id: item.eventId,
                            status: item.status,
                            testerName: item.testerName,
                            createdAt: item.createdAt,
                            notes: item.notes,
                            environment: item.environment,
                            attachments: item.attachments
                          }))}
                          emptyMessage="No shared history has been imported for this scenario yet."
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                          Shared results are not configured for this project.
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {error && detail ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
              {error}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
