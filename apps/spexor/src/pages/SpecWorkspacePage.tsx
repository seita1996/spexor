import type {
  ExecutionSessionDetailDto,
  FeatureDetailDto,
  LatestScenarioResult,
  RunStatus,
  ScenarioCaseDto,
  ScenarioGroupDto,
  ScenarioHistoryDto,
  SharedSyncStatusDto,
  SpecsListItemDto
} from "@spexor/app";
import { ParseHealthBadge, RunHistoryList, StatusBadge } from "@spexor/ui";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { IssueList } from "../components/IssueList";
import { ScenarioExecutionPanel } from "../components/ScenarioExecutionPanel";
import { ThemeToggle } from "../components/theme-toggle";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  createExecutionSession,
  getExecutionSession,
  getFeature,
  getScenarioHistory,
  getSharedSyncStatus,
  getSpecCatalog,
  saveScenarioRun,
  saveSessionScenarioRun,
  syncSharedResults,
  syncSpecs
} from "../lib/api";
import { cn } from "../lib/utils";

interface CatalogFeatureNode {
  id: string;
  title: string;
  featureTitle?: string | undefined;
  filePath: string;
  parseHealth: SpecsListItemDto["parseHealth"];
  issueCount: number;
  issues: SpecsListItemDto["issues"];
  metadata: SpecsListItemDto["metadata"];
  scenarioCount: number;
  latestResults: LatestScenarioResult[];
  status: RunStatus | null;
  detail: FeatureDetailDto | null;
  loadingDetail: boolean;
  detailError: string | null;
}

interface CatalogScenarioNode {
  id: string;
  featureId: string;
  featureTitle: string;
  featurePath: string;
  groupId: string;
  groupTitle: string;
  groupKind: ScenarioGroupDto["kind"];
  title: string;
  description: string;
  kind: ScenarioCaseDto["kind"];
  tags: string[];
  steps: ScenarioCaseDto["steps"];
  latestResult: LatestScenarioResult | null;
  sourceLine?: number | null | undefined;
  exampleName?: string | undefined;
  exampleIndex?: number | undefined;
  exampleValues?: Record<string, string> | undefined;
}

interface CheckpointRecord {
  title: string;
  files: string[];
  changes: string;
  verification: string;
  remaining: string;
}

const checkpointRecords: CheckpointRecord[] = [
  {
    title: "Checkpoint 1: Catalog normalization",
    files: ["apps/spexor/src/pages/SpecWorkspacePage.tsx"],
    changes:
      "Normalize existing specs and feature detail DTOs into feature/scenario nodes without changing API or DB contracts.",
    verification:
      "Unit coverage should assert search and selection behavior; quality gate: pnpm guard:fast.",
    remaining:
      "Catalog API is additive; the client still keeps a fallback for older running API processes."
  },
  {
    title: "Checkpoint 2-3: Explorer and scenario search",
    files: ["apps/spexor/src/pages/SpecWorkspacePage.tsx"],
    changes:
      "Add a left Spec Explorer with feature/scenario hierarchy, selected state, status badges, file paths, tags, and search.",
    verification:
      "Search by scenario title, tag, and file path in browser and tests.",
    remaining: "Folder and browser filters are reserved for a later PR."
  },
  {
    title: "Checkpoint 4-5: Scenario workspace and manual execution",
    files: [
      "apps/spexor/src/pages/SpecWorkspacePage.tsx",
      "apps/spexor/src/components/ScenarioExecutionPanel.tsx"
    ],
    changes:
      "Show selected scenario detail, Gherkin steps, background, and reuse the existing run recording panel.",
    verification:
      "Save result through POST /api/scenarios/:id/runs and verify UI reloads the selected feature.",
    remaining:
      "Batch session routes now land in the workspace; dedicated batch-progress UX can be added later."
  },
  {
    title: "Checkpoint 6-8: Context, states, and accessibility",
    files: ["apps/spexor/src/pages/SpecWorkspacePage.tsx"],
    changes:
      "Add persistent Context/History panel, loading/error/empty states, keyboard-selectable tree items, and focus styles.",
    verification:
      "Browser sanity check at http://127.0.0.1:4173/ plus pnpm test.",
    remaining:
      "Advanced keyboard shortcuts are intentionally deferred; native Tab/Enter/Space behavior is supported."
  }
];

const paneWidthDefaults = {
  left: 300,
  right: 360
};
const paneWidthLimits = {
  leftMin: 220,
  leftMax: 520,
  rightMin: 280,
  rightMax: 560
};
const paneWidthStorageKey = "spexor.workspace-pane-widths";

export function SpecWorkspacePage() {
  const params = useParams();
  const navigate = useNavigate();
  const routeFeatureId = params["*"] ?? "";
  const routeSessionId = params["sessionId"] ?? "";
  const [features, setFeatures] = useState<CatalogFeatureNode[]>([]);
  const [executionSession, setExecutionSession] =
    useState<ExecutionSessionDetailDto | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  const [syncingShared, setSyncingShared] = useState(false);
  const [leftPaneWidth, setLeftPaneWidth] = useState(
    () => loadStoredPaneWidths().left
  );
  const [rightPaneWidth, setRightPaneWidth] = useState(
    () => loadStoredPaneWidths().right
  );
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScenarioHistoryDto | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sharedSyncStatus, setSharedSyncStatus] =
    useState<SharedSyncStatusDto | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    saveStoredPaneWidths({
      left: leftPaneWidth,
      right: rightPaneWidth
    });
  }, [leftPaneWidth, rightPaneWidth]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        setLoading(true);
        await syncSpecs();
        if (cancelled) {
          return;
        }
        const [catalog, syncStatus, sessionDetail] = await Promise.all([
          getSpecCatalog(),
          getSharedSyncStatus(),
          routeSessionId ? getExecutionSession(routeSessionId) : null
        ]);
        if (cancelled) {
          return;
        }

        setSharedSyncStatus(syncStatus);
        setExecutionSession(sessionDetail);
        setFeatures(toFeatureNodes(catalog.items, catalog.features));
        setError(null);
        const firstScenario = catalog.features
          .flatMap((feature) => feature.scenarioGroups)
          .flatMap((group) => group.cases)
          .at(0);
        setSelectedScenarioId(
          (current) =>
            current ??
            sessionDetail?.nextScenarioId ??
            findFirstScenarioIdForFeature(catalog.features, routeFeatureId) ??
            firstScenario?.id ??
            null
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load specs."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [routeFeatureId, routeSessionId]);

  const scenarios = useMemo(() => flattenScenarios(features), [features]);
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  const selectedFeature =
    features.find((feature) => feature.id === selectedScenario?.featureId) ??
    features[0] ??
    null;
  const selectedFeatureScenarios = useMemo(
    () =>
      selectedFeature?.detail?.scenarioGroups.flatMap((group) =>
        group.cases.map((scenario) => ({
          id: scenario.id,
          title: scenario.title,
          groupTitle: group.title
        }))
      ) ?? [],
    [selectedFeature]
  );
  const selectedScenarioIndex = selectedFeatureScenarios.findIndex(
    (scenario) => scenario.id === selectedScenarioId
  );

  const filteredFeatures = useMemo(
    () =>
      filterFeatures(filterFeaturesForSession(features, executionSession), {
        query: deferredQuery,
        tag: tagFilter,
        environment: environmentFilter
      }),
    [features, executionSession, deferredQuery, environmentFilter, tagFilter]
  );
  const filteredScenarios = useMemo(
    () => flattenScenarios(filteredFeatures),
    [filteredFeatures]
  );
  const totalScenarioCount = scenarios.length;
  const loadingDetails = features.some((feature) => feature.loadingDetail);
  const tagOptions = useMemo(
    () =>
      [...new Set(features.flatMap((feature) => feature.metadata.tags))].sort(),
    [features]
  );
  const environmentOptions = useMemo(
    () =>
      [
        ...new Set(features.flatMap((feature) => feature.metadata.environments))
      ].sort(),
    [features]
  );

  useEffect(() => {
    if (loading || loadingDetails) {
      return;
    }

    if (filteredScenarios.length === 0) {
      setSelectedScenarioId(null);
      return;
    }

    if (
      !selectedScenarioId ||
      !filteredScenarios.some((scenario) => scenario.id === selectedScenarioId)
    ) {
      setSelectedScenarioId(filteredScenarios[0]?.id ?? null);
    }
  }, [filteredScenarios, loading, loadingDetails, selectedScenarioId]);

  useEffect(() => {
    if (!selectedScenario) {
      setHistory(null);
      return;
    }

    let cancelled = false;
    const scenarioId = selectedScenario.id;

    async function loadHistory() {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        const nextHistory = await getScenarioHistory(scenarioId);
        if (!cancelled) {
          setHistory(nextHistory);
        }
      } catch (loadError) {
        if (!cancelled) {
          setHistoryError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load scenario history."
          );
          setHistory(null);
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedScenario]);

  const reloadFeature = async (featureId: string) => {
    const detail = await getFeature(featureId);
    setFeatures((current) =>
      current.map((feature) =>
        feature.id === featureId
          ? {
              ...feature,
              detail,
              detailError: null,
              loadingDetail: false,
              latestResults: detail.scenarioGroups.flatMap((group) =>
                group.cases.flatMap((scenario) =>
                  scenario.latestResult ? [scenario.latestResult] : []
                )
              ),
              status: summarizeFeatureStatus(detail)
            }
          : feature
      )
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            S
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Spexor</div>
            <div className="truncate text-xs text-muted-foreground">
              Git-managed manual spec workspace
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sharedSyncStatus?.enabled ? (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              shared: {sharedSyncStatus.projectId}
            </Badge>
          ) : (
            <Badge variant="outline" className="hidden sm:inline-flex">
              local only
            </Badge>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main
        className="grid h-[calc(100vh-3.5rem)] overflow-hidden lg:grid-cols-[var(--left-pane-width)_8px_minmax(0,1fr)_8px_var(--right-pane-width)]"
        style={
          {
            "--left-pane-width": `${leftPaneWidth}px`,
            "--right-pane-width": `${rightPaneWidth}px`
          } as CSSProperties
        }
      >
        <SpecExplorer
          features={filteredFeatures}
          allFeatureCount={features.length}
          totalScenarioCount={totalScenarioCount}
          query={query}
          loading={loading}
          loadingDetails={loadingDetails}
          refreshing={refreshing}
          executionSession={executionSession}
          selectedScenarioId={selectedScenarioId}
          error={error}
          onQueryChange={setQuery}
          tagFilter={tagFilter}
          environmentFilter={environmentFilter}
          tagOptions={tagOptions}
          environmentOptions={environmentOptions}
          onTagFilterChange={setTagFilter}
          onEnvironmentFilterChange={setEnvironmentFilter}
          onSelectScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setSaveError(null);
          }}
          onRefresh={async () => {
            try {
              setRefreshing(true);
              await syncSpecs();
              const catalog = await getSpecCatalog();
              setFeatures(toFeatureNodes(catalog.items, catalog.features));
              setSelectedScenarioId(
                catalog.features
                  .flatMap((detail) => detail.scenarioGroups)
                  .flatMap((group) => group.cases)
                  .at(0)?.id ?? null
              );
              setError(null);
            } catch (refreshError) {
              setError(
                refreshError instanceof Error
                  ? refreshError.message
                  : "Failed to rescan specs."
              );
            } finally {
              setRefreshing(false);
            }
          }}
        />

        <PaneResizeHandle
          label="Resize spec explorer"
          onReset={() => setLeftPaneWidth(paneWidthDefaults.left)}
          onDrag={(deltaX) =>
            setLeftPaneWidth((current) =>
              clamp(
                current + deltaX,
                paneWidthLimits.leftMin,
                paneWidthLimits.leftMax
              )
            )
          }
        />

        <ScenarioWorkspace
          feature={selectedFeature}
          scenario={selectedScenario}
          featureScenarios={selectedFeatureScenarios}
          selectedScenarioIndex={selectedScenarioIndex}
          executionSession={executionSession}
          loading={loading || loadingDetails}
          saving={saving}
          startingSession={startingSession}
          saveError={saveError}
          onStartFeatureSession={async () => {
            if (!selectedFeature?.detail) {
              return;
            }
            try {
              setStartingSession(true);
              const session = await createExecutionSession({
                name: `Feature session: ${selectedFeature.title}`,
                filters: {
                  search: "",
                  tag: "",
                  environment: "",
                  priority: ""
                },
                scenarioIds: selectedFeature.detail.scenarioGroups.flatMap(
                  (group) => group.cases.map((scenario) => scenario.id)
                )
              });
              setExecutionSession(session);
              setSelectedScenarioId(
                session.nextScenarioId ?? session.items[0]?.scenarioId ?? null
              );
              void navigate(`/sessions/${session.id}`);
            } finally {
              setStartingSession(false);
            }
          }}
          onSelectScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setSaveError(null);
          }}
          onExitSession={() => {
            setExecutionSession(null);
            void navigate(
              selectedFeature ? `/features/${selectedFeature.id}` : "/"
            );
          }}
          onSave={async (payload) => {
            if (!selectedScenario) {
              return;
            }
            try {
              setSaving(true);
              setSaveError(null);
              if (executionSession) {
                await saveSessionScenarioRun(
                  executionSession.id,
                  selectedScenario.id,
                  payload
                );
                const nextSession = await getExecutionSession(
                  executionSession.id
                );
                setExecutionSession(
                  nextSession.resolvedCount > executionSession.resolvedCount
                    ? nextSession
                    : resolveSessionScenario(
                        executionSession,
                        selectedScenario.id,
                        payload.status
                      )
                );
                setSelectedScenarioId(
                  nextSession.nextScenarioId ?? selectedScenario.id
                );
              } else {
                await saveScenarioRun(selectedScenario.id, payload);
              }
              await reloadFeature(selectedScenario.featureId);
              const nextHistory = await getScenarioHistory(selectedScenario.id);
              setHistory(nextHistory);
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

        <PaneResizeHandle
          label="Resize context panel"
          onReset={() => setRightPaneWidth(paneWidthDefaults.right)}
          onDrag={(deltaX) =>
            setRightPaneWidth((current) =>
              clamp(
                current - deltaX,
                paneWidthLimits.rightMin,
                paneWidthLimits.rightMax
              )
            )
          }
        />

        <ScenarioContextPanel
          feature={selectedFeature}
          scenario={selectedScenario}
          history={history}
          loading={historyLoading}
          error={historyError}
          syncingShared={syncingShared}
          onSyncShared={async () => {
            if (!selectedScenario) {
              return;
            }
            try {
              setSyncingShared(true);
              await syncSharedResults();
              const [nextHistory, nextStatus] = await Promise.all([
                getScenarioHistory(selectedScenario.id),
                getSharedSyncStatus()
              ]);
              setHistory(nextHistory);
              setSharedSyncStatus(nextStatus);
              setHistoryError(null);
            } catch (syncError) {
              setHistoryError(
                syncError instanceof Error
                  ? syncError.message
                  : "Failed to sync shared results."
              );
            } finally {
              setSyncingShared(false);
            }
          }}
        />
      </main>
    </div>
  );
}

function SpecExplorer(props: {
  features: CatalogFeatureNode[];
  allFeatureCount: number;
  totalScenarioCount: number;
  query: string;
  executionSession: ExecutionSessionDetailDto | null;
  tagFilter: string;
  environmentFilter: string;
  tagOptions: string[];
  environmentOptions: string[];
  loading: boolean;
  loadingDetails: boolean;
  refreshing: boolean;
  selectedScenarioId: string | null;
  error: string | null;
  onQueryChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onEnvironmentFilterChange: (value: string) => void;
  onSelectScenario: (scenarioId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <aside className="min-h-0 overflow-hidden border-r border-border bg-muted/25">
      <div className="grid min-h-0 grid-rows-[auto_1fr_auto]">
        <section className="grid gap-2 border-b border-border bg-card/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xs font-semibold uppercase text-muted-foreground">
                {props.executionSession ? "Session Explorer" : "Spec Explorer"}
              </h1>
              <div className="mt-1 text-xs text-muted-foreground">
                {props.allFeatureCount} files / {props.totalScenarioCount}{" "}
                scenarios
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={props.refreshing}
              onClick={() => void props.onRefresh()}
            >
              {props.refreshing ? "Syncing" : "Rescan"}
            </Button>
          </div>
          {props.executionSession ? (
            <SessionProgressSummary session={props.executionSession} />
          ) : null}
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Search scenarios, tags, files
            <Input
              value={props.query}
              onChange={(event) => props.onQueryChange(event.target.value)}
              placeholder="scenario, @tag, file path"
              className="h-9"
            />
          </label>
          <div className="grid gap-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Tag
              <select
                aria-label="Filter by tag"
                value={props.tagFilter}
                onChange={(event) =>
                  props.onTagFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All tags</option>
                {props.tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Environment
              <select
                aria-label="Filter by environment"
                value={props.environmentFilter}
                onChange={(event) =>
                  props.onEnvironmentFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All environments</option>
                {props.environmentOptions.map((environment) => (
                  <option key={environment} value={environment}>
                    {environment}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="rounded border border-border bg-background px-2 py-1">
              folder filters later
            </span>
            <span className="rounded border border-border bg-background px-2 py-1">
              browser filters later
            </span>
          </div>
        </section>

        <div className="min-h-0 overflow-y-auto">
          {props.error ? (
            <StateBlock tone="error">{props.error}</StateBlock>
          ) : null}
          {props.loading ? <StateBlock>Loading specs...</StateBlock> : null}
          {!props.loading && props.features.length === 0 ? (
            <StateBlock>
              No scenarios match the current search. Try a scenario title, tag,
              or file path.
            </StateBlock>
          ) : null}
          <div className="py-1">
            {props.features.map((feature) => (
              <FeatureTree
                key={feature.id}
                feature={feature}
                selectedScenarioId={props.selectedScenarioId}
                onSelectScenario={props.onSelectScenario}
              />
            ))}
          </div>
        </div>

        <section className="border-t border-border bg-card/70 p-3 text-xs text-muted-foreground">
          {props.loadingDetails
            ? "Loading scenario detail..."
            : "Use Tab, Enter, or Space to select a scenario."}
        </section>
      </div>
    </aside>
  );
}

function PaneResizeHandle(props: {
  label: string;
  onDrag: (deltaX: number) => void;
  onReset: () => void;
}) {
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    let lastDelta = 0;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextDelta = moveEvent.clientX - startX;
      props.onDrag(nextDelta - lastDelta);
      lastDelta = nextDelta;
    };

    const onPointerUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  return (
    <button
      type="button"
      aria-label={props.label}
      title={`${props.label}. Double click to reset.`}
      onPointerDown={startDrag}
      onDoubleClick={props.onReset}
      className="hidden cursor-col-resize border-x border-transparent bg-border/30 transition hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block"
    />
  );
}

function FeatureTree(props: {
  feature: CatalogFeatureNode;
  selectedScenarioId: string | null;
  onSelectScenario: (scenarioId: string) => void;
}) {
  const scenarioCount =
    props.feature.detail?.scenarioGroups.reduce(
      (count, group) => count + group.cases.length,
      0
    ) ?? props.feature.scenarioCount;

  return (
    <section className="border-b border-border/60">
      <header className="grid gap-0.5 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">▾</span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {props.feature.title}
          </span>
          <TreeStatusDot status={props.feature.status} />
        </div>
        <div className="truncate pl-4 font-mono text-[10px] text-muted-foreground">
          {props.feature.filePath} · {scenarioCount}
        </div>
      </header>

      {props.feature.detailError ? (
        <div className="px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {props.feature.detailError}
        </div>
      ) : null}

      <div className="pb-1">
        {props.feature.detail?.scenarioGroups.map((group) => (
          <div key={group.id} className="grid">
            {shouldShowGroupLabel(group) ? (
              <div className="truncate px-2 py-0.5 pl-6 text-[10px] font-semibold uppercase text-muted-foreground">
                {group.title}
              </div>
            ) : null}
            {group.cases.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => props.onSelectScenario(scenario.id)}
                title={scenario.title}
                className={cn(
                  "flex w-full items-center gap-1.5 border-l-2 px-2 py-1 pl-8 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  scenario.id === props.selectedScenarioId
                    ? "border-primary bg-primary/10"
                    : "border-transparent hover:bg-muted/60"
                )}
              >
                <TreeStatusDot status={scenario.latestResult?.status ?? null} />
                <span className="min-w-0 flex-1 truncate">
                  {scenario.title}
                </span>
                {scenario.sourceLine ? (
                  <span className="text-[10px] text-muted-foreground">
                    {scenario.sourceLine}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TreeStatusDot(props: { status: RunStatus | null }) {
  const styles: Record<RunStatus | "not-run", string> = {
    passed: "bg-emerald-500",
    failed: "bg-rose-500",
    blocked: "bg-amber-500",
    skipped: "bg-slate-500",
    "not-run": "bg-muted-foreground/35"
  };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        styles[props.status ?? "not-run"]
      )}
    />
  );
}

function shouldShowGroupLabel(group: ScenarioGroupDto): boolean {
  return !(group.cases.length === 1 && group.cases[0]?.title === group.title);
}

function SessionProgressSummary(props: { session: ExecutionSessionDetailDto }) {
  const completionRate =
    props.session.totalCount === 0
      ? 0
      : Math.round(
          (props.session.resolvedCount / props.session.totalCount) * 100
        );

  return (
    <section className="grid gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <div className="font-semibold text-foreground">{props.session.name}</div>
      <div className="text-muted-foreground">
        {props.session.resolvedCount} / {props.session.totalCount} scenarios
        resolved · {completionRate}%
      </div>
      <div className="text-muted-foreground">
        {props.session.status === "completed" ? "Completed" : "Active session"}
      </div>
    </section>
  );
}

function ScenarioWorkspace(props: {
  feature: CatalogFeatureNode | null;
  scenario: CatalogScenarioNode | null;
  featureScenarios: Array<{ id: string; title: string; groupTitle: string }>;
  selectedScenarioIndex: number;
  executionSession: ExecutionSessionDetailDto | null;
  loading: boolean;
  saving: boolean;
  startingSession: boolean;
  saveError: string | null;
  onStartFeatureSession: () => Promise<void>;
  onSelectScenario: (scenarioId: string) => void;
  onExitSession: () => void;
  onSave: Parameters<typeof ScenarioExecutionPanel>[0]["onSubmit"];
}) {
  if (props.loading && !props.scenario) {
    return (
      <StateBlock className="m-4">Loading scenario workspace...</StateBlock>
    );
  }

  if (!props.scenario || !props.feature) {
    return (
      <section className="grid place-items-center border-b border-border p-6 lg:border-b-0">
        <div className="max-w-md rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Select a scenario from the explorer to inspect steps and record a
          manual result.
        </div>
      </section>
    );
  }

  const background = props.feature.detail?.background ?? [];
  const environments = props.feature.metadata.environments;
  const selectedScenarioNumber =
    props.selectedScenarioIndex >= 0 ? props.selectedScenarioIndex + 1 : 1;
  const previousScenario =
    props.selectedScenarioIndex > 0
      ? props.featureScenarios[props.selectedScenarioIndex - 1]
      : null;
  const nextScenario =
    props.selectedScenarioIndex >= 0 &&
    props.selectedScenarioIndex < props.featureScenarios.length - 1
      ? props.featureScenarios[props.selectedScenarioIndex + 1]
      : null;

  return (
    <section className="min-h-0 overflow-y-auto border-b border-border bg-background lg:border-b-0">
      <div className="mx-auto grid max-w-5xl gap-4 p-4 lg:p-6">
        <header className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <nav
              aria-label="Workspace breadcrumb"
              className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground"
            >
              <span>Workspace</span>
              <span aria-hidden="true">/</span>
              {props.executionSession ? (
                <>
                  <span className="truncate text-foreground">
                    {props.executionSession.name}
                  </span>
                  <span aria-hidden="true">/</span>
                </>
              ) : null}
              <span className="truncate">{props.feature.title}</span>
              <span aria-hidden="true">/</span>
              <span className="truncate text-foreground">
                Scenario {selectedScenarioNumber} of{" "}
                {props.featureScenarios.length}
              </span>
            </nav>
            {props.executionSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onExitSession}
              >
                Back to workspace
              </Button>
            ) : null}
          </div>

          {props.featureScenarios.length > 1 ? (
            <div className="grid gap-2 rounded-md border border-border bg-muted/25 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!previousScenario}
                onClick={() => {
                  if (previousScenario) {
                    props.onSelectScenario(previousScenario.id);
                  }
                }}
              >
                Previous scenario
              </Button>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                Scenario in feature
                <select
                  className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={props.scenario.id}
                  onChange={(event) =>
                    props.onSelectScenario(event.currentTarget.value)
                  }
                >
                  {props.featureScenarios.map((scenario, index) => (
                    <option key={scenario.id} value={scenario.id}>
                      {index + 1}. {scenario.title}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!nextScenario}
                onClick={() => {
                  if (nextScenario) {
                    props.onSelectScenario(nextScenario.id);
                  }
                }}
              >
                Next scenario
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={props.scenario.latestResult?.status ?? "not-run"}
                />
                <Badge variant="secondary">{props.scenario.kind}</Badge>
                {props.scenario.sourceLine ? (
                  <Badge variant="outline">
                    line {props.scenario.sourceLine}
                  </Badge>
                ) : null}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {props.scenario.title}
              </h2>
              <div className="mt-2 truncate font-mono text-xs text-muted-foreground">
                {props.scenario.featurePath}
              </div>
            </div>
            <FeatureHealthSummary feature={props.feature} />
          </div>
          {props.scenario.description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {props.scenario.description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {props.scenario.tags.length > 0 ? (
              props.scenario.tags.map((tag) => (
                <span
                  key={`${props.scenario?.id}-${tag}`}
                  className="rounded-full border border-border bg-muted px-2 py-1 text-xs"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No tags</span>
            )}
          </div>
        </header>

        {props.feature.issues.length > 0 ? (
          <IssueList issues={props.feature.issues} />
        ) : null}

        {background.length > 0 ? (
          <StepSection title="Background" steps={background} />
        ) : null}

        <StepSection title="Scenario steps" steps={props.scenario.steps} />

        {props.scenario.exampleValues ? (
          <section className="grid gap-2 rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground">
              Example values
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(props.scenario.exampleValues).map(
                ([key, value]) => (
                  <span
                    key={`${props.scenario?.id}-${key}`}
                    className="rounded border border-border bg-muted px-2 py-1 text-xs"
                  >
                    {key}: {value}
                  </span>
                )
              )}
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                {props.executionSession
                  ? "Session execution"
                  : "Manual execution"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {props.executionSession
                  ? "Record this scenario against the active execution session."
                  : "Record the current result. Spexor stores the run in SQLite and leaves the `.feature` file unchanged."}
              </p>
            </div>
            {!props.executionSession ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={props.startingSession}
                onClick={() => void props.onStartFeatureSession()}
              >
                {props.startingSession
                  ? "Starting..."
                  : "Start feature session"}
              </Button>
            ) : null}
          </div>
          <ScenarioExecutionPanel
            key={props.scenario.id}
            scenarioId={props.scenario.id}
            scenarioTitle={props.scenario.title}
            environments={environments}
            compact
            isSaving={props.saving}
            saveError={props.saveError}
            resetOnSubmit
            onSubmit={props.onSave}
          />
        </section>
      </div>
    </section>
  );
}

function StepSection(props: {
  title: string;
  steps: Array<{ keyword: string; text: string }>;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold uppercase text-muted-foreground">
        {props.title}
      </h3>
      {props.steps.length > 0 ? (
        <ol className="grid gap-2">
          {props.steps.map((step, index) => (
            <li
              key={`${props.title}-${index + 1}`}
              className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md border border-border bg-muted/35 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-foreground">
                {step.keyword}
              </span>
              <span className="text-muted-foreground">{step.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          No steps are available for this scenario.
        </div>
      )}
    </section>
  );
}

function FeatureHealthSummary(props: { feature: CatalogFeatureNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ParseHealthBadge health={props.feature.parseHealth} />
      <StatusBadge status={props.feature.status ?? "not-run"} compact />
      <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
        {props.feature.scenarioCount} scenario
        {props.feature.scenarioCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function ScenarioContextPanel(props: {
  feature: CatalogFeatureNode | null;
  scenario: CatalogScenarioNode | null;
  history: ScenarioHistoryDto | null;
  loading: boolean;
  error: string | null;
  syncingShared: boolean;
  onSyncShared: () => Promise<void>;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l-0 border-border bg-muted/25 lg:border-l">
      <div className="grid gap-4 p-4">
        <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Context
          </h2>
          {props.scenario ? (
            <>
              <div>
                <div className="text-sm font-semibold">
                  {props.scenario.featureTitle}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                  {props.scenario.featurePath}
                </div>
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                <div>Group: {props.scenario.groupTitle}</div>
                <div>
                  Latest:{" "}
                  {props.scenario.latestResult
                    ? `${props.scenario.latestResult.status} by ${props.scenario.latestResult.testerName}`
                    : "not run"}
                </div>
                <div>
                  Environments:{" "}
                  {props.feature?.metadata.environments.join(", ") || "none"}
                </div>
                <div>Owner: {props.feature?.metadata.owner ?? "none"}</div>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a scenario to see context.
            </div>
          )}
        </section>

        {props.feature ? (
          <FeatureReferencePanel feature={props.feature} />
        ) : null}

        <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              History
            </h2>
            {props.history?.syncStatus.enabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={props.syncingShared}
                onClick={() => void props.onSyncShared()}
              >
                {props.syncingShared ? "Syncing" : "Sync"}
              </Button>
            ) : null}
          </div>

          {props.loading ? <StateBlock>Loading history...</StateBlock> : null}
          {props.error ? (
            <StateBlock tone="error">{props.error}</StateBlock>
          ) : null}

          {!props.loading && !props.error && props.history ? (
            <div className="grid gap-4">
              <div className="rounded-md border border-border bg-muted/35 px-3 py-2 text-sm">
                {props.history.delta.summaryLabel}
              </div>
              <RunHistoryList
                items={props.history.history}
                emptyMessage="No local runs have been recorded for this scenario."
              />
              {props.history.sharedHistoryEnabled ? (
                <section className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    Shared history
                  </h3>
                  <RunHistoryList
                    items={props.history.sharedHistory.map((item) => ({
                      id: item.eventId,
                      status: item.status,
                      testerName: item.testerName,
                      createdAt: item.createdAt,
                      notes: item.notes,
                      environment: item.environment,
                      attachments: item.attachments
                    }))}
                    emptyMessage="No shared runs have been imported for this scenario."
                  />
                </section>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  Shared results are not configured for this project.
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="grid gap-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Implementation checkpoints
          </h2>
          {checkpointRecords.map((record) => (
            <details key={record.title} className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {record.title}
              </summary>
              <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <div>
                  <dt className="font-semibold text-foreground">Files</dt>
                  <dd>{record.files.join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Changes</dt>
                  <dd>{record.changes}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Check</dt>
                  <dd>{record.verification}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-foreground">Remaining</dt>
                  <dd>{record.remaining}</dd>
                </div>
              </dl>
            </details>
          ))}
        </section>
      </div>
    </aside>
  );
}

function FeatureReferencePanel(props: { feature: CatalogFeatureNode }) {
  const detail = props.feature.detail;
  const verification =
    detail?.verification ?? props.feature.metadata.verification;
  const environments = detail?.environmentStatuses ?? [];

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground">
          Feature reference
        </h2>
        <Badge variant={verification.manualOnly ? "secondary" : "success"}>
          {verification.manualOnly ? "Manual only" : "Automation linked"}
        </Badge>
      </div>

      {props.feature.metadata.related.length > 0 ? (
        <div className="grid gap-1 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">Related</div>
          {props.feature.metadata.related.map((item) => (
            <div
              key={`${props.feature.id}-related-${item}`}
              className="break-all"
            >
              {item}
            </div>
          ))}
        </div>
      ) : null}

      {environments.length > 0 ? (
        <div className="grid gap-2">
          <div className="text-xs font-semibold text-foreground">
            Latest by environment
          </div>
          <div className="grid gap-2">
            {environments.map((item) => (
              <div
                key={item.environment}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <span className="truncate text-xs text-muted-foreground">
                  {item.environment}
                </span>
                <StatusBadge
                  status={item.aggregateStatus ?? "not-run"}
                  compact
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {verification.automated.length > 0 ? (
        <div className="grid gap-2">
          <div className="text-xs font-semibold text-foreground">
            Automated coverage
          </div>
          {verification.automated.map((reference, index) => (
            <article
              key={`${reference.runner}-${reference.file}-${index}`}
              className="grid gap-2 rounded-md border border-border bg-muted/25 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{reference.runner}</Badge>
                <code className="break-all text-xs text-muted-foreground">
                  {reference.file}
                </code>
              </div>
              {reference.tests.length > 0 ? (
                <ul className="grid gap-1 text-xs text-muted-foreground">
                  {reference.tests.map((testPath) => (
                    <li key={`${reference.file}-${testPath}`}>{testPath}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No specific test entries were provided.
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          No automated coverage is linked for this feature.
        </div>
      )}
    </section>
  );
}

function StateBlock(props: {
  children: React.ReactNode;
  tone?: "default" | "error";
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-5 text-sm",
        props.tone === "error"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200"
          : "border-dashed border-border bg-muted/30 text-muted-foreground",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

function toFeatureNodes(
  items: SpecsListItemDto[],
  details: FeatureDetailDto[] = []
): CatalogFeatureNode[] {
  return items.map((item) => ({
    id: item.featureId,
    title: item.title,
    featureTitle: item.featureTitle,
    filePath: item.filePath,
    parseHealth: item.parseHealth,
    issueCount: item.issueCount,
    issues: item.issues,
    metadata: item.metadata,
    scenarioCount: item.scenarioCount,
    latestResults: item.latestResults,
    status: item.statusSummary.aggregate,
    detail:
      details.find((detail) => detail.featureId === item.featureId) ?? null,
    loadingDetail: false,
    detailError: null
  }));
}

function flattenScenarios(
  features: CatalogFeatureNode[]
): CatalogScenarioNode[] {
  return features.flatMap((feature) =>
    (feature.detail?.scenarioGroups ?? []).flatMap((group) =>
      group.cases.map((scenario) => ({
        id: scenario.id,
        featureId: feature.id,
        featureTitle: feature.title,
        featurePath: feature.filePath,
        groupId: group.id,
        groupTitle: group.title,
        groupKind: group.kind,
        title: scenario.title,
        description: scenario.description,
        kind: scenario.kind,
        tags: scenario.tags,
        steps: scenario.steps,
        latestResult: scenario.latestResult,
        sourceLine: scenario.sourceLine,
        exampleName: scenario.exampleName,
        exampleIndex: scenario.exampleIndex,
        exampleValues: scenario.exampleValues
      }))
    )
  );
}

function filterFeatures(
  features: CatalogFeatureNode[],
  filters: { query: string; tag: string; environment: string }
): CatalogFeatureNode[] {
  const query = filters.query.trim().replace(/^@/, "").toLowerCase();

  return features.flatMap((feature) => {
    const matchesFeatureTag =
      !filters.tag || feature.metadata.tags.includes(filters.tag);
    const matchesFeatureEnvironment =
      !filters.environment ||
      feature.metadata.environments.includes(filters.environment);
    if (!matchesFeatureTag || !matchesFeatureEnvironment) {
      return [];
    }

    const detail = feature.detail;
    if (!query) {
      return [feature];
    }

    const featureMatches = [
      feature.title,
      feature.featureTitle,
      feature.filePath,
      feature.metadata.owner,
      ...feature.metadata.tags,
      ...feature.metadata.environments,
      ...feature.metadata.related
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));

    if (!detail) {
      return featureMatches ? [feature] : [];
    }

    const groups = detail.scenarioGroups.flatMap((group) => {
      const cases = group.cases.filter((scenario) =>
        [
          scenario.title,
          scenario.description,
          group.title,
          group.description,
          ...scenario.tags,
          ...scenario.steps.map((step) => `${step.keyword} ${step.text}`)
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query))
      );

      if (featureMatches) {
        return [group];
      }

      return cases.length > 0 ? [{ ...group, cases }] : [];
    });

    return featureMatches || groups.length > 0
      ? [
          {
            ...feature,
            detail: {
              ...detail,
              scenarioGroups: groups
            }
          }
        ]
      : [];
  });
}

function filterFeaturesForSession(
  features: CatalogFeatureNode[],
  session: ExecutionSessionDetailDto | null
): CatalogFeatureNode[] {
  if (!session) {
    return features;
  }

  const scenarioIds = new Set(session.items.map((item) => item.scenarioId));

  return features.flatMap((feature) => {
    const detail = feature.detail;
    if (!detail) {
      return [];
    }

    const scenarioGroups = detail.scenarioGroups.flatMap((group) => {
      const cases = group.cases.filter((scenario) =>
        scenarioIds.has(scenario.id)
      );
      return cases.length > 0 ? [{ ...group, cases }] : [];
    });

    return scenarioGroups.length > 0
      ? [
          {
            ...feature,
            detail: {
              ...detail,
              scenarioGroups
            }
          }
        ]
      : [];
  });
}

function resolveSessionScenario(
  session: ExecutionSessionDetailDto,
  scenarioId: string,
  status: RunStatus
): ExecutionSessionDetailDto {
  const items = session.items.map((item) =>
    item.scenarioId === scenarioId
      ? {
          ...item,
          resolvedStatus: status
        }
      : item
  );
  const resolvedCount = items.filter((item) => item.resolvedStatus).length;

  return {
    ...session,
    items,
    resolvedCount,
    status: resolvedCount >= session.totalCount ? "completed" : "active",
    nextScenarioId:
      items.find((item) => !item.resolvedStatus)?.scenarioId ?? null
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function loadStoredPaneWidths(): { left: number; right: number } {
  if (typeof window === "undefined") {
    return paneWidthDefaults;
  }

  try {
    const raw = window.localStorage.getItem(paneWidthStorageKey);
    const parsed = raw
      ? (JSON.parse(raw) as { left?: unknown; right?: unknown })
      : {};

    return {
      left: clampPaneWidth("left", parsed.left),
      right: clampPaneWidth("right", parsed.right)
    };
  } catch {
    return paneWidthDefaults;
  }
}

function saveStoredPaneWidths(value: { left: number; right: number }): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(paneWidthStorageKey, JSON.stringify(value));
}

function clampPaneWidth(side: "left" | "right", value: unknown): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  const fallback = paneWidthDefaults[side];
  const resolvedValue = Number.isFinite(numericValue) ? numericValue : fallback;

  return side === "left"
    ? clamp(resolvedValue, paneWidthLimits.leftMin, paneWidthLimits.leftMax)
    : clamp(resolvedValue, paneWidthLimits.rightMin, paneWidthLimits.rightMax);
}

function findFirstScenarioIdForFeature(
  features: FeatureDetailDto[],
  featureId: string
): string | null {
  if (!featureId) {
    return null;
  }

  return (
    features
      .find((feature) => feature.featureId === featureId)
      ?.scenarioGroups.flatMap((group) => group.cases)
      .at(0)?.id ?? null
  );
}

function summarizeFeatureStatus(detail: FeatureDetailDto): RunStatus | null {
  const statuses = detail.scenarioGroups.flatMap((group) =>
    group.cases.flatMap((scenario) =>
      scenario.latestResult ? [scenario.latestResult.status] : []
    )
  );

  if (statuses.includes("failed")) {
    return "failed";
  }
  if (statuses.includes("blocked")) {
    return "blocked";
  }
  if (statuses.includes("skipped")) {
    return "skipped";
  }
  if (statuses.includes("passed")) {
    return "passed";
  }
  return null;
}
