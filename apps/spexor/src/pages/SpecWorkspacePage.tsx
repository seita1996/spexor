import type {
  ExecutionSessionDetailDto,
  RecordScenarioResultInput,
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
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import {
  createExecutionSession,
  getExecutionSession,
  getFeature,
  getScenarioHistory,
  getSharedSyncStatus,
  getSpecCatalog,
  retryExecutionSession,
  saveScenarioRun,
  saveSessionScenarioRun,
  syncSharedResults,
  syncSpecs
} from "../lib/api";
import { cn } from "../lib/utils";

interface CatalogFeatureNode {
  id: string;
  identity: SpecsListItemDto["identity"];
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
  identity: ScenarioCaseDto["identity"];
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

interface EvidenceDraft {
  id: string;
  kind: "file" | "url";
  value: string;
  label: string;
}

const runStatusOptions: RunStatus[] = [
  "passed",
  "failed",
  "blocked",
  "skipped"
];
const testerNameStorageKey = "spexor.testerName";
let sessionEvidenceDraftCount = 0;

function createSessionEvidenceDraft(): EvidenceDraft {
  sessionEvidenceDraftCount += 1;
  return {
    id: `session-evidence-${sessionEvidenceDraftCount}`,
    kind: "file",
    value: "",
    label: ""
  };
}

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
  const routeFeatureId = params["featureId"] ?? params["*"] ?? "";
  const routeScenarioId = params["scenarioId"] ?? "";
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
  const [domainFilter, setDomainFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [identityFilter, setIdentityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
  const [_sharedSyncStatus, setSharedSyncStatus] =
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
        const directScenario = catalog.features
          .flatMap((feature) => feature.scenarioGroups)
          .flatMap((group) => group.cases)
          .find((scenario) => scenario.id === routeScenarioId);
        setSelectedScenarioId(
          sessionDetail?.nextScenarioId ??
            directScenario?.id ??
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
  }, [routeFeatureId, routeScenarioId, routeSessionId]);

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
        environment: environmentFilter,
        domain: domainFilter,
        lifecycle: lifecycleFilter,
        identity: identityFilter,
        status: statusFilter
      }),
    [
      features,
      executionSession,
      deferredQuery,
      environmentFilter,
      tagFilter,
      domainFilter,
      lifecycleFilter,
      identityFilter,
      statusFilter
    ]
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
  const domainOptions = useMemo(
    () =>
      [
        ...new Set(
          features.flatMap((feature) =>
            feature.metadata.domain ? [feature.metadata.domain] : []
          )
        )
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
    <div className="h-full overflow-hidden bg-background text-foreground">
      <main
        className="grid h-full grid-rows-[minmax(240px,40vh)_minmax(520px,auto)_minmax(360px,auto)] overflow-y-auto lg:grid-cols-[var(--left-pane-width)_8px_minmax(0,1fr)_8px_var(--right-pane-width)] lg:grid-rows-none lg:overflow-hidden"
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
          domainFilter={domainFilter}
          lifecycleFilter={lifecycleFilter}
          identityFilter={identityFilter}
          statusFilter={statusFilter}
          tagOptions={tagOptions}
          environmentOptions={environmentOptions}
          domainOptions={domainOptions}
          onTagFilterChange={setTagFilter}
          onEnvironmentFilterChange={setEnvironmentFilter}
          onDomainFilterChange={setDomainFilter}
          onLifecycleFilterChange={setLifecycleFilter}
          onIdentityFilterChange={setIdentityFilter}
          onStatusFilterChange={setStatusFilter}
          onStartFilteredRun={async () => {
            if (filteredScenarios.length === 0) {
              return;
            }
            try {
              setStartingSession(true);
              const session = await createExecutionSession({
                name: `Filtered run (${filteredScenarios.length} scenarios)`,
                filters: {
                  search: query,
                  tag: tagFilter,
                  environment: environmentFilter,
                  priority: ""
                },
                scenarioIds: filteredScenarios.map((scenario) => scenario.id)
              });
              setExecutionSession(session);
              setSelectedScenarioId(
                session.nextScenarioId ?? session.items[0]?.scenarioId ?? null
              );
              void navigate(`/runs/${encodeURIComponent(session.id)}`);
            } finally {
              setStartingSession(false);
            }
          }}
          startingRun={startingSession}
          onSelectScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setSaveError(null);
            if (!executionSession) {
              const scenario = scenarios.find((item) => item.id === scenarioId);
              if (scenario) {
                void navigate(
                  `/explore/features/${encodeURIComponent(scenario.featureId)}/scenarios/${encodeURIComponent(scenario.id)}`
                );
              }
            }
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
                name: `Feature run: ${selectedFeature.title}`,
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
              void navigate(`/runs/${encodeURIComponent(session.id)}`);
            } finally {
              setStartingSession(false);
            }
          }}
          onStartScenarioSession={async () => {
            if (!selectedScenario) {
              return;
            }
            try {
              setStartingSession(true);
              const session = await createExecutionSession({
                name: `Scenario run: ${selectedScenario.title}`,
                filters: {
                  search: "",
                  tag: "",
                  environment: "",
                  priority: ""
                },
                scenarioIds: [selectedScenario.id]
              });
              setExecutionSession(session);
              setSelectedScenarioId(selectedScenario.id);
              void navigate(`/runs/${encodeURIComponent(session.id)}`);
            } finally {
              setStartingSession(false);
            }
          }}
          onSelectScenario={(scenarioId) => {
            setSelectedScenarioId(scenarioId);
            setSaveError(null);
            if (!executionSession) {
              const scenario = scenarios.find((item) => item.id === scenarioId);
              if (scenario) {
                void navigate(
                  `/explore/features/${encodeURIComponent(scenario.featureId)}/scenarios/${encodeURIComponent(scenario.id)}`
                );
              }
            }
          }}
          onExitSession={() => {
            setExecutionSession(null);
            void navigate(
              selectedFeature
                ? `/explore/features/${encodeURIComponent(selectedFeature.id)}`
                : "/explore"
            );
          }}
          onRetrySession={async () => {
            if (!executionSession) {
              return;
            }
            const retry = await retryExecutionSession(executionSession.id);
            setExecutionSession(retry);
            setSelectedScenarioId(
              retry.nextScenarioId ?? retry.items[0]?.scenarioId ?? null
            );
            void navigate(`/runs/${encodeURIComponent(retry.id)}`);
          }}
          onSaveSessionScenario={async (scenarioId, payload) => {
            if (!executionSession) {
              return;
            }
            const sessionItem = executionSession.items.find(
              (item) => item.scenarioId === scenarioId
            );
            try {
              setSaving(true);
              setSaveError(null);
              await saveSessionScenarioRun(
                executionSession.id,
                scenarioId,
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
                      scenarioId,
                      payload.status
                    )
              );
              if (sessionItem) {
                await reloadFeature(sessionItem.featureId);
              }
              if (selectedScenario?.id === scenarioId) {
                const nextHistory = await getScenarioHistory(scenarioId);
                setHistory(nextHistory);
              }
              setSelectedScenarioId(nextSession.nextScenarioId ?? scenarioId);
            } catch (submitError) {
              setSaveError(
                submitError instanceof Error
                  ? submitError.message
                  : "Failed to save run."
              );
              throw submitError;
            } finally {
              setSaving(false);
            }
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
  domainFilter: string;
  lifecycleFilter: string;
  identityFilter: string;
  statusFilter: string;
  tagOptions: string[];
  environmentOptions: string[];
  domainOptions: string[];
  loading: boolean;
  loadingDetails: boolean;
  refreshing: boolean;
  selectedScenarioId: string | null;
  error: string | null;
  onQueryChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onEnvironmentFilterChange: (value: string) => void;
  onDomainFilterChange: (value: string) => void;
  onLifecycleFilterChange: (value: string) => void;
  onIdentityFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onStartFilteredRun: () => Promise<void>;
  startingRun: boolean;
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
                {props.executionSession ? "Run Explorer" : "Explore"}
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
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Domain
              <select
                aria-label="Filter by domain"
                value={props.domainFilter}
                onChange={(event) =>
                  props.onDomainFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All domains</option>
                {props.domainOptions.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Lifecycle
              <select
                aria-label="Filter by lifecycle"
                value={props.lifecycleFilter}
                onChange={(event) =>
                  props.onLifecycleFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All lifecycles</option>
                {[
                  ["draft", "Draft"],
                  ["active", "Active"],
                  ["deprecated", "Deprecated"],
                  ["archived", "Archived"]
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Identity source
              <select
                aria-label="Filter by identity source"
                value={props.identityFilter}
                onChange={(event) =>
                  props.onIdentityFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All identities</option>
                <option value="explicit">Explicit</option>
                <option value="legacy">Legacy</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Latest status
              <select
                aria-label="Filter by latest status"
                value={props.statusFilter}
                onChange={(event) =>
                  props.onStatusFilterChange(event.target.value)
                }
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All statuses</option>
                <option value="not-run">Not run</option>
                {runStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!props.executionSession ? (
            <Button
              type="button"
              size="sm"
              disabled={props.startingRun || props.features.length === 0}
              onClick={() => void props.onStartFilteredRun()}
            >
              {props.startingRun ? "Starting..." : "Run current filter"}
            </Button>
          ) : null}
        </section>

        <div className="min-h-0 overflow-y-auto">
          {props.error ? (
            <StateBlock tone="error">{props.error}</StateBlock>
          ) : null}
          {props.loading ? <StateBlock>Loading specs...</StateBlock> : null}
          {!props.loading && props.features.length === 0 ? (
            <StateBlock>
              {props.allFeatureCount === 0
                ? "No specification files were found. Add a .feature file, then rescan."
                : "No scenarios match the current filters. Adjust search, metadata, identity, or status filters."}
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
          {!props.feature.identity.stable ? (
            <span
              title="Legacy ID: add an explicit Feature ID"
              className="text-[10px] font-semibold text-amber-700 dark:text-amber-300"
            >
              ID!
            </span>
          ) : null}
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
                {!scenario.identity?.stable ? (
                  <span
                    title="Legacy ID: add an explicit Scenario ID"
                    className="text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                  >
                    ID!
                  </span>
                ) : null}
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
  const counts = countRunStatuses(props.session);

  return (
    <section className="grid gap-1 rounded-lg border border-border bg-background px-3 py-2 text-xs">
      <div className="font-semibold text-foreground">{props.session.name}</div>
      <div className="text-muted-foreground">
        {props.session.resolvedCount} / {props.session.totalCount} scenarios
        resolved · {completionRate}%
      </div>
      <div className="text-muted-foreground">
        {props.session.status === "completed" ? "Completed" : "Active run"}
      </div>
      <div className="flex flex-wrap gap-1">
        {runStatusOptions.map((status) => (
          <span key={status} className="rounded bg-muted px-1.5 py-0.5">
            {status} {counts[status]}
          </span>
        ))}
        <span className="rounded bg-muted px-1.5 py-0.5">
          not-run {counts["not-run"]}
        </span>
      </div>
      <div className="text-muted-foreground">
        {formatGitContext(props.session.gitContext)}
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
  onStartScenarioSession: () => Promise<void>;
  onSelectScenario: (scenarioId: string) => void;
  onExitSession: () => void;
  onRetrySession: () => Promise<void>;
  onSaveSessionScenario: (
    scenarioId: string,
    input: RecordScenarioResultInput
  ) => Promise<void>;
  onSave: Parameters<typeof ScenarioExecutionPanel>[0]["onSubmit"];
}) {
  if (props.loading && !props.scenario) {
    return (
      <StateBlock className="m-4">Loading scenario workspace...</StateBlock>
    );
  }

  if (props.executionSession && (!props.scenario || !props.feature)) {
    return (
      <section className="min-h-0 overflow-y-auto bg-background">
        <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold">Historical run snapshot</h2>
              <p className="text-sm text-muted-foreground">
                Current source specifications are unavailable. The immutable
                steps captured when this run started remain readable.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={props.onExitSession}
            >
              Back to workspace
            </Button>
          </header>
          <SessionExecutionGrid
            session={props.executionSession}
            isSaving={props.saving}
            saveError={props.saveError}
            onSaveScenario={props.onSaveSessionScenario}
            onRetry={props.onRetrySession}
          />
        </div>
      </section>
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
  const sourcePath = props.scenario.featurePath;
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(sourcePath)}
              >
                Copy source path
              </Button>
              <FeatureHealthSummary feature={props.feature} />
            </div>
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

        {props.executionSession ? (
          <SessionExecutionGrid
            session={props.executionSession}
            isSaving={props.saving}
            saveError={props.saveError}
            onSaveScenario={props.onSaveSessionScenario}
            onRetry={props.onRetrySession}
          />
        ) : (
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Manual execution
                </h3>
                <p className="text-sm text-muted-foreground">
                  Record the current result. Spexor stores the run in SQLite and
                  leaves the `.feature` file unchanged.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={props.startingSession}
                  onClick={() => void props.onStartScenarioSession()}
                >
                  {props.startingSession ? "Starting..." : "Start scenario run"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={props.startingSession}
                  onClick={() => void props.onStartFeatureSession()}
                >
                  {props.startingSession ? "Starting..." : "Start feature run"}
                </Button>
              </div>
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
        )}
      </div>
    </section>
  );
}

function SessionExecutionGrid(props: {
  session: ExecutionSessionDetailDto;
  isSaving: boolean;
  saveError: string | null;
  onSaveScenario: (
    scenarioId: string,
    input: RecordScenarioResultInput
  ) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const environments = useMemo(
    () =>
      Array.from(
        new Set(props.session.items.flatMap((item) => item.environments))
      ),
    [props.session.items]
  );
  const [testerName, setTesterName] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return window.localStorage.getItem(testerNameStorageKey) ?? "";
  });
  const [environment, setEnvironment] = useState(
    props.session.filters.environment || environments[0] || ""
  );
  const [activeScenarioId, setActiveScenarioId] = useState(
    props.session.nextScenarioId ?? props.session.items[0]?.scenarioId ?? null
  );
  const [shortcutSelection, setShortcutSelection] = useState<{
    scenarioId: string;
    status: RunStatus;
    revision: number;
  } | null>(null);
  const readOnly = props.session.status === "completed";

  useEffect(() => {
    setEnvironment(
      (current) =>
        current || props.session.filters.environment || environments[0] || ""
    );
  }, [environments, props.session.filters.environment]);

  useEffect(() => {
    if (props.session.nextScenarioId) {
      setActiveScenarioId(props.session.nextScenarioId);
    }
  }, [props.session.nextScenarioId]);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select, button") ||
          target.isContentEditable)
      ) {
        return;
      }
      const currentIndex = props.session.items.findIndex(
        (item) => item.scenarioId === activeScenarioId
      );
      if (event.key === "j" || event.key === "J" || event.key === "ArrowDown") {
        event.preventDefault();
        const next =
          props.session.items[
            Math.min(currentIndex + 1, props.session.items.length - 1)
          ];
        setActiveScenarioId(next?.scenarioId ?? activeScenarioId);
        return;
      }
      if (event.key === "k" || event.key === "K" || event.key === "ArrowUp") {
        event.preventDefault();
        const previous = props.session.items[Math.max(currentIndex - 1, 0)];
        setActiveScenarioId(previous?.scenarioId ?? activeScenarioId);
        return;
      }
      const status = shortcutRunStatus(event.key);
      if (status && activeScenarioId) {
        event.preventDefault();
        setShortcutSelection((current) => ({
          scenarioId: activeScenarioId,
          status,
          revision: (current?.revision ?? 0) + 1
        }));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeScenarioId, props.session.items, readOnly]);

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Run execution
          </h3>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? "This completed Run is an immutable historical record."
              : "Record each Scenario directly from the active Run; saved rows advance focus automatically."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(180px,240px)_minmax(160px,220px)]">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Tester or developer
            <Input
              required
              disabled={readOnly}
              value={testerName}
              onChange={(event) => setTesterName(event.target.value)}
              placeholder="Your name or email"
            />
          </label>
          {environments.length > 0 ? (
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Environment
              <Select
                disabled={readOnly}
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              >
                {environments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <RunCompletionSummary session={props.session} onRetry={props.onRetry} />
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span>P passed</span>
          <span>F failed</span>
          <span>B blocked</span>
          <span>S skipped</span>
          <span>J / ↓ next</span>
          <span>K / ↑ previous</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead className="bg-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="w-[18%] border-b border-border px-3 py-2">
                Given
              </th>
              <th className="w-[18%] border-b border-border px-3 py-2">When</th>
              <th className="w-[18%] border-b border-border px-3 py-2">Then</th>
              <th className="w-[150px] border-b border-border px-3 py-2">
                Status
              </th>
              <th className="w-[300px] border-b border-border px-3 py-2">
                Notes / Refs
              </th>
              <th className="w-[120px] border-b border-border px-3 py-2">
                Save
              </th>
            </tr>
          </thead>
          <tbody>
            {props.session.items.map((item) => (
              <SessionExecutionRow
                key={item.scenarioId}
                item={item}
                testerName={testerName}
                environment={environment}
                isSaving={props.isSaving}
                readOnly={readOnly}
                active={item.scenarioId === activeScenarioId}
                shortcutSelection={
                  shortcutSelection?.scenarioId === item.scenarioId
                    ? shortcutSelection
                    : null
                }
                onActivate={() => setActiveScenarioId(item.scenarioId)}
                onSave={async (input) => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(
                      testerNameStorageKey,
                      testerName.trim()
                    );
                  }
                  await props.onSaveScenario(item.scenarioId, input);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {props.saveError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {props.saveError}
        </div>
      ) : null}
    </section>
  );
}

function SessionExecutionRow(props: {
  item: ExecutionSessionDetailDto["items"][number];
  testerName: string;
  environment: string;
  isSaving: boolean;
  readOnly: boolean;
  active: boolean;
  shortcutSelection: {
    status: RunStatus;
    revision: number;
  } | null;
  onActivate: () => void;
  onSave: (input: RecordScenarioResultInput) => Promise<void>;
}) {
  const [status, setStatus] = useState<RunStatus>(
    props.item.resolvedStatus ?? props.item.latestResult?.status ?? "passed"
  );
  const [savedStatus, setSavedStatus] = useState<RunStatus | null>(
    props.item.resolvedStatus
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [notes, setNotes] = useState(props.item.latestResult?.notes ?? "");
  const [attachments, setAttachments] = useState<EvidenceDraft[]>(() =>
    (props.item.latestResult?.attachments ?? []).length > 0
      ? (props.item.latestResult?.attachments ?? []).map((attachment) => ({
          id: createSessionEvidenceDraft().id,
          kind: attachment.kind,
          value: attachment.value,
          label: attachment.label ?? ""
        }))
      : [createSessionEvidenceDraft()]
  );
  const stepGroups = groupSessionSteps(props.item.steps ?? []);

  useEffect(() => {
    setSavedStatus(props.item.resolvedStatus);
  }, [props.item.resolvedStatus]);

  useEffect(() => {
    if (props.shortcutSelection) {
      setStatus(props.shortcutSelection.status);
      setSaveState("idle");
    }
  }, [props.shortcutSelection]);

  return (
    <tr
      onClick={props.onActivate}
      className={cn(
        "border-b border-border align-top last:border-b-0",
        savedStatus ? "bg-card" : "bg-muted/10",
        props.active && !props.readOnly && "ring-2 ring-inset ring-primary/50"
      )}
    >
      <StepCell
        title={props.item.scenarioTitle}
        featureTitle={props.item.featureTitle}
        sourceLine={props.item.sourceLine}
        steps={stepGroups.given}
      />
      <StepCell steps={stepGroups.when} />
      <StepCell steps={stepGroups.thenSteps} />
      <td className="border-l border-border px-3 py-3">
        <div className="grid gap-2">
          {savedStatus ? (
            <StatusBadge status={savedStatus} compact />
          ) : (
            <span className="w-fit rounded-full border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
              Not saved
            </span>
          )}
          <Select
            aria-label={`Status for ${props.item.scenarioTitle}`}
            value={status}
            disabled={props.readOnly}
            onChange={(event) => {
              setStatus(event.target.value as RunStatus);
              setSaveState("idle");
            }}
            className="h-9"
          >
            {runStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          {props.item.isStale ? (
            <Badge variant="outline" className="w-fit">
              {props.item.isCurrentSpecAvailable
                ? "stale · spec changed"
                : "stale · source removed"}
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="border-l border-border px-3 py-3">
        <div className="grid gap-2">
          <Textarea
            aria-label={`Notes for ${props.item.scenarioTitle}`}
            value={notes}
            disabled={props.readOnly}
            onChange={(event) => {
              setNotes(event.target.value);
              setSaveState("idle");
            }}
            className="min-h-24 resize-y"
            placeholder="Observed behavior, setup notes, or blockers"
          />
          {props.readOnly ? (
            <span className="text-xs text-muted-foreground">
              {
                attachments.filter((attachment) => attachment.value.trim())
                  .length
              }{" "}
              refs
            </span>
          ) : (
            <RefsDialog
              scenarioTitle={props.item.scenarioTitle}
              attachments={attachments}
              onChange={(nextAttachments) => {
                setAttachments(nextAttachments);
                setSaveState("idle");
              }}
            />
          )}
        </div>
      </td>
      <td className="border-l border-border px-3 py-3">
        <div className="grid gap-2">
          <Button
            type="button"
            size="sm"
            disabled={
              props.isSaving ||
              props.readOnly ||
              saveState === "saving" ||
              props.testerName.trim().length === 0 ||
              !props.item.isCurrentSpecAvailable
            }
            onClick={() => {
              void (async () => {
                try {
                  setSaveState("saving");
                  await props.onSave({
                    testerName: props.testerName.trim(),
                    environment: props.environment || undefined,
                    status,
                    notes,
                    attachments: attachments
                      .filter((attachment) => attachment.value.trim())
                      .map((attachment) => ({
                        kind: attachment.kind,
                        value: attachment.value.trim(),
                        label: attachment.label.trim() || undefined
                      }))
                  });
                  setSavedStatus(status);
                  setSaveState("saved");
                } catch {
                  setSaveState("error");
                }
              })();
            }}
          >
            {props.readOnly
              ? "Locked"
              : saveState === "saving" || props.isSaving
                ? "Saving..."
                : props.item.isCurrentSpecAvailable
                  ? "Save"
                  : "Unavailable"}
          </Button>
          <span
            className={cn(
              "text-xs",
              saveState === "saved" && "text-emerald-700 dark:text-emerald-300",
              saveState === "error" && "text-rose-700 dark:text-rose-300",
              saveState !== "saved" &&
                saveState !== "error" &&
                "text-muted-foreground"
            )}
            role={
              saveState === "saved" || saveState === "error"
                ? "status"
                : undefined
            }
          >
            {saveState === "saved"
              ? "Saved"
              : saveState === "error"
                ? "Save failed"
                : savedStatus
                  ? "Recorded"
                  : "Pending"}
          </span>
        </div>
      </td>
    </tr>
  );
}

function RunCompletionSummary(props: {
  session: ExecutionSessionDetailDto;
  onRetry: () => Promise<void>;
}) {
  const counts = countRunStatuses(props.session);
  const retryCount = counts.failed + counts.blocked;
  const testers = uniqueStrings(
    props.session.items.flatMap((item) =>
      item.latestResult?.testerName ? [item.latestResult.testerName] : []
    )
  );
  const environments = uniqueStrings(
    props.session.items.flatMap((item) =>
      item.latestResult?.environment ? [item.latestResult.environment] : []
    )
  );
  const evidenceCount = props.session.items.reduce(
    (total, item) => total + (item.latestResult?.attachments.length ?? 0),
    0
  );

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-muted/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">Run completed</h4>
          <p className="text-xs text-muted-foreground">
            {props.session.completedAt
              ? new Date(props.session.completedAt).toLocaleString()
              : "Completion time unavailable"}
          </p>
        </div>
        {retryCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void props.onRetry()}
          >
            Retry failed / blocked ({retryCount})
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {runStatusOptions.map((status) => (
          <Badge key={status} variant="outline">
            {status}: {counts[status]}
          </Badge>
        ))}
      </div>
      <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Git</dt>
          <dd>{formatGitContext(props.session.gitContext)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Environment</dt>
          <dd>{environments.join(", ") || "not recorded"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Testers</dt>
          <dd>{testers.join(", ") || "not recorded"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Evidence</dt>
          <dd>{evidenceCount} refs</dd>
        </div>
        {props.session.baseRunId ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">Retry of</dt>
            <dd className="font-mono">{props.session.baseRunId}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function countRunStatuses(
  session: ExecutionSessionDetailDto
): Record<RunStatus | "not-run", number> {
  const counts: Record<RunStatus | "not-run", number> = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    "not-run": 0
  };
  for (const item of session.items) {
    counts[item.resolvedStatus ?? "not-run"] += 1;
  }
  return counts;
}

function shortcutRunStatus(key: string): RunStatus | null {
  const shortcuts: Record<string, RunStatus> = {
    p: "passed",
    f: "failed",
    b: "blocked",
    s: "skipped"
  };
  return shortcuts[key.toLowerCase()] ?? null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function StepCell(props: {
  title?: string | undefined;
  featureTitle?: string | undefined;
  sourceLine?: number | null | undefined;
  steps: string[];
}) {
  return (
    <td className="px-3 py-3">
      {props.title ? (
        <div className="mb-3 grid gap-1 border-b border-border pb-2">
          <div className="font-medium text-foreground">{props.title}</div>
          <div className="text-xs text-muted-foreground">
            {props.featureTitle}
            {props.sourceLine ? ` · line ${props.sourceLine}` : ""}
          </div>
        </div>
      ) : null}
      {props.steps.length > 0 ? (
        <ol className="grid gap-2">
          {props.steps.map((step, index) => (
            <li
              key={`${step}-${index + 1}`}
              className="rounded-md bg-muted/35 px-2 py-1.5 text-sm leading-5 text-muted-foreground"
            >
              {step}
            </li>
          ))}
        </ol>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </td>
  );
}

function RefsDialog(props: {
  scenarioTitle: string;
  attachments: EvidenceDraft[];
  onChange: (attachments: EvidenceDraft[]) => void;
}) {
  const attachmentCount = props.attachments.filter((attachment) =>
    attachment.value.trim()
  ).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {attachmentCount > 0 ? `Refs (${attachmentCount})` : "Refs"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refs</DialogTitle>
          <DialogDescription>{props.scenarioTitle}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {props.attachments.map((attachment, index) => (
            <div
              key={attachment.id}
              className="grid gap-2 md:grid-cols-[120px_1fr_1fr]"
            >
              <Select
                aria-label={`Ref kind ${index + 1}`}
                value={attachment.kind}
                onChange={(event) =>
                  props.onChange(
                    props.attachments.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            kind: event.target.value as EvidenceDraft["kind"]
                          }
                        : item
                    )
                  )
                }
              >
                <option value="file">file</option>
                <option value="url">url</option>
              </Select>
              <Input
                aria-label={`Ref value ${index + 1}`}
                value={attachment.value}
                onChange={(event) =>
                  props.onChange(
                    props.attachments.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
                placeholder={
                  attachment.kind === "file"
                    ? "/tmp/screenshot.png"
                    : "https://example.com/log"
                }
              />
              <Input
                aria-label={`Ref label ${index + 1}`}
                value={attachment.label}
                onChange={(event) =>
                  props.onChange(
                    props.attachments.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Optional label"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              props.onChange([
                ...props.attachments,
                createSessionEvidenceDraft()
              ])
            }
          >
            Add ref
          </Button>
          <DialogClose asChild>
            <Button type="button">Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <Badge variant="outline">
        {props.feature.metadata.lifecycle ?? "active"}
      </Badge>
      {!props.feature.identity.stable ? (
        <Badge
          variant="outline"
          className="border-amber-500/40 text-amber-700 dark:text-amber-300"
        >
          Legacy ID
        </Badge>
      ) : null}
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
                <div>Domain: {props.feature?.metadata.domain ?? "none"}</div>
                <div>
                  Lifecycle: {props.feature?.metadata.lifecycle ?? "active"}
                </div>
                <div className="break-all font-mono">
                  Feature ID: {props.feature?.identity.id ?? "unknown"}
                </div>
                <div className="break-all font-mono">
                  Scenario ID: {props.scenario.identity.id}
                </div>
                {!props.scenario.identity.stable ||
                !props.feature?.identity.stable ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-2 font-sans text-amber-800 dark:text-amber-200">
                    This specification uses a legacy path-based ID. Add an
                    explicit ID to keep history stable across renames and moves.
                  </div>
                ) : null}
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
    identity: item.identity ?? {
      id: item.featureId,
      source: "legacy",
      stable: false
    },
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
        identity: scenario.identity ?? {
          id: scenario.scenarioId,
          source: "legacy",
          stable: false
        },
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
  filters: {
    query: string;
    tag: string;
    environment: string;
    domain: string;
    lifecycle: string;
    identity: string;
    status: string;
  }
): CatalogFeatureNode[] {
  const query = filters.query.trim().replace(/^@/, "").toLowerCase();

  return features.flatMap((feature) => {
    const matchesFeatureTag =
      !filters.tag || feature.metadata.tags.includes(filters.tag);
    const matchesFeatureEnvironment =
      !filters.environment ||
      feature.metadata.environments.includes(filters.environment);
    const matchesDomain =
      !filters.domain || feature.metadata.domain === filters.domain;
    const matchesLifecycle =
      !filters.lifecycle || feature.metadata.lifecycle === filters.lifecycle;
    const matchesIdentity =
      !filters.identity || feature.identity.source === filters.identity;
    const matchesStatus =
      !filters.status ||
      (filters.status === "not-run"
        ? feature.status === null
        : feature.status === filters.status);
    if (
      !matchesFeatureTag ||
      !matchesFeatureEnvironment ||
      !matchesDomain ||
      !matchesLifecycle ||
      !matchesIdentity ||
      !matchesStatus
    ) {
      return [];
    }

    const detail = feature.detail;
    if (!query) {
      return [feature];
    }

    const featureMatches = [
      feature.title,
      feature.featureTitle,
      feature.identity.id,
      feature.filePath,
      feature.metadata.owner,
      feature.metadata.domain,
      feature.metadata.lifecycle,
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
          scenario.identity?.id,
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

function groupSessionSteps(
  steps: Array<{ keyword: string; text: string }>
): Record<"given" | "when" | "thenSteps", string[]> {
  const groups: Record<"given" | "when" | "thenSteps", string[]> = {
    given: [],
    when: [],
    thenSteps: []
  };
  let currentGroup: keyof typeof groups = "given";

  for (const step of steps) {
    const keyword = step.keyword.trim().toLowerCase();
    if (keyword === "given") {
      currentGroup = "given";
    } else if (keyword === "when") {
      currentGroup = "when";
    } else if (keyword === "then") {
      currentGroup = "thenSteps";
    }
    groups[currentGroup].push(step.text);
  }

  return groups;
}

function formatGitContext(
  context: ExecutionSessionDetailDto["gitContext"]
): string {
  if (!context.available) {
    return "Git context unavailable";
  }

  const revision = [
    context.branch ?? "detached HEAD",
    context.commitSha?.slice(0, 8)
  ]
    .filter(Boolean)
    .join(" @ ");
  const worktree = context.dirty ? "dirty worktree" : "clean worktree";
  return `Git ${revision} · ${worktree}`;
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
