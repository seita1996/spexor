import fs from "node:fs/promises";
import { loadConfig, type ResolvedSpexorConfig } from "@spexor/config";
import { initDatabase, parseJson, type SpexorDatabase } from "@spexor/db";
import {
  type EvidenceRef,
  type FeatureMetadata,
  type LatestScenarioResult,
  type ParseHealth,
  type ParseIssue,
  type Priority,
  type RunStatus,
  type ScenarioCaseSpec,
  type StatusSummary,
  type StepSpec,
  summarizeLatestStatuses
} from "@spexor/domain";
import { parseSpecFile, scanSpecFiles } from "@spexor/parser";
import {
  buildSharedRunEvent,
  defaultProjectId,
  fetchSharedScenarioResults,
  importSharedRunEvents,
  stringifySharedRunEventsNdjson,
  type SharedRunEvent
} from "@spexor/results";
import chokidar, { type FSWatcher } from "chokidar";

export interface SpecsListItemDto {
  featureId: string;
  title: string;
  featureTitle?: string | undefined;
  filePath: string;
  parseHealth: ParseHealth;
  issueCount: number;
  issues: ParseIssue[];
  metadata: FeatureMetadata;
  scenarioCount: number;
  latestResults: LatestScenarioResult[];
  statusSummary: StatusSummary;
}

export interface ScenarioCaseDto extends ScenarioCaseSpec {
  sourceLine?: number | null;
  latestResult: LatestScenarioResult | null;
}

export interface ScenarioGroupDto {
  id: string;
  title: string;
  description: string;
  kind: "scenario" | "outline";
  aggregateStatus: RunStatus | null;
  cases: ScenarioCaseDto[];
}

export interface FeatureDetailDto {
  featureId: string;
  title: string;
  featureTitle?: string | undefined;
  filePath: string;
  parseHealth: ParseHealth;
  issueCount: number;
  issues: ParseIssue[];
  metadata: FeatureMetadata;
  description: string;
  background: StepSpec[];
  scenarioGroups: ScenarioGroupDto[];
}

export interface RecordScenarioResultInput {
  testerName: string;
  environment?: string | undefined;
  status: RunStatus;
  notes?: string | undefined;
  attachments?: EvidenceRef[] | undefined;
}

export interface ScenarioHistoryDto {
  scenarioId: string;
  scenarioTitle: string;
  featureId: string;
  history: LatestScenarioResult[];
  sharedHistoryEnabled: boolean;
  sharedHistory: SharedRunEvent[];
  delta: ScenarioSharedDeltaDto;
  syncStatus: SharedSyncStatusDto;
  sharedHistoryError?: string | undefined;
}

export interface RunResultsExportDto {
  projectId: string;
  exportedAt: string;
  itemCount: number;
  ndjson: string;
}

export interface SharedSyncStatusDto {
  enabled: boolean;
  baseUrl?: string | undefined;
  projectId?: string | undefined;
  lastSyncAt?: string | undefined;
  lastSyncError?: string | undefined;
  offlineLike: boolean;
}

export interface ScenarioSharedDeltaDto {
  localLatest: LatestScenarioResult | null;
  sharedLatest: SharedRunEvent | null;
  state: "in-sync" | "local-only" | "shared-newer" | "different";
  summaryLabel: string;
}

export interface SharedSyncResultDto {
  acceptedCount: number;
  exportedCount: number;
  syncedAt: string;
}

export interface ExecutionSessionFilters {
  search: string;
  tag: string;
  environment: string;
  priority: Priority | "";
}

export interface CreateExecutionSessionInput {
  name?: string | undefined;
  filters: ExecutionSessionFilters;
  scenarioIds?: string[] | undefined;
}

export interface ExecutionSessionListItemDto {
  id: string;
  name: string;
  status: "active" | "completed";
  createdAt: string;
  completedAt: string | null;
  totalCount: number;
  resolvedCount: number;
  nextScenarioId: string | null;
  nextFeatureId: string | null;
}

export interface ExecutionSessionItemDto {
  scenarioId: string;
  featureId: string;
  featureTitle: string;
  scenarioTitle: string;
  sortOrder: number;
  sourceLine?: number | null;
  steps?: StepSpec[] | undefined;
  environments: string[];
  latestResult: LatestScenarioResult | null;
  resolvedStatus: RunStatus | null;
  isStale: boolean;
}

export interface ExecutionSessionDetailDto extends ExecutionSessionListItemDto {
  filters: ExecutionSessionFilters;
  items: ExecutionSessionItemDto[];
}

export interface SpexorHealthDto {
  ok: true;
  config: {
    rootDir: string;
    specDir: string;
    dbPath: string;
    evidenceDir: string;
    autoScan: boolean;
    sharedResults?:
      | {
          baseUrl: string;
          projectId: string;
        }
      | undefined;
  };
}

export interface SpexorApp {
  config: ResolvedSpexorConfig;
  syncSpecsFromFilesystem(): Promise<{ processedCount: number }>;
  getSpecsList(): Promise<SpecsListItemDto[]>;
  getFeatureDetail(featureId: string): Promise<FeatureDetailDto | null>;
  getScenarioHistory(scenarioId: string): Promise<ScenarioHistoryDto | null>;
  exportRunResultsNdjson(): Promise<RunResultsExportDto>;
  getSharedSyncStatus(): Promise<SharedSyncStatusDto>;
  syncSharedResults(): Promise<SharedSyncResultDto>;
  createExecutionSession(
    input: CreateExecutionSessionInput
  ): Promise<ExecutionSessionDetailDto>;
  getExecutionSessions(): Promise<ExecutionSessionListItemDto[]>;
  getExecutionSession(
    sessionId: string
  ): Promise<ExecutionSessionDetailDto | null>;
  recordScenarioResult(
    scenarioId: string,
    input: RecordScenarioResultInput
  ): Promise<LatestScenarioResult>;
  recordSessionScenarioResult(
    sessionId: string,
    scenarioId: string,
    input: RecordScenarioResultInput
  ): Promise<LatestScenarioResult>;
  getHealth(): SpexorHealthDto;
  close(): Promise<void>;
}

export async function createSpexorApp(
  options: { rootDir?: string } = {}
): Promise<SpexorApp> {
  const config = await loadConfig(
    options.rootDir ? { cwd: options.rootDir } : {}
  );
  await fs.mkdir(config.specDirAbs, { recursive: true });
  await fs.mkdir(config.evidenceDirAbs, { recursive: true });
  const database = initDatabase(config.dbPathAbs);

  let watcher: FSWatcher | null = null;
  let syncTimeout: NodeJS.Timeout | undefined;

  const syncSpecsFromFilesystem = async (): Promise<{
    processedCount: number;
  }> => {
    const specFiles = await scanSpecFiles(config.specDirAbs);
    const parsedFiles = await Promise.all(
      specFiles.map((filePath) =>
        parseSpecFile(filePath, { rootDir: config.rootDir })
      )
    );
    return database.saveParsedSpecs(parsedFiles);
  };

  const scheduleSync = () => {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }

    syncTimeout = setTimeout(() => {
      void syncSpecsFromFilesystem().catch((error) => {
        console.error("[spexor] auto-sync failed", error);
      });
    }, 150);
  };

  await syncSpecsFromFilesystem();

  if (config.autoScan) {
    watcher = chokidar.watch(config.specDirAbs, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 120,
        pollInterval: 50
      }
    });

    watcher.on("add", scheduleSync);
    watcher.on("change", scheduleSync);
    watcher.on("unlink", scheduleSync);
  }

  const getSpecsList = async (): Promise<SpecsListItemDto[]> => {
    const rows = database.getSpecsOverview();

    return rows.map((row) => {
      const feature = database.getFeature(row.relativePath);
      const latestResults = feature
        ? database.getFeatureLatestResults(row.relativePath)
        : [];
      return {
        featureId: row.relativePath,
        title: feature?.displayTitle ?? row.displayTitle,
        featureTitle: feature?.featureTitle,
        filePath: row.relativePath,
        parseHealth: row.parseHealth as ParseHealth,
        issueCount: row.issueCount,
        issues: parseJson<ParseIssue[]>(row.issuesJson, []),
        metadata: feature
          ? parseJson<FeatureMetadata>(feature.metadataJson, emptyMetadata())
          : emptyMetadata(),
        scenarioCount: row.scenarioCount,
        latestResults,
        statusSummary: summarizeLatestStatuses(latestResults)
      };
    });
  };

  const getExecutionSessionDetail = async (
    sessionId: string
  ): Promise<ExecutionSessionDetailDto | null> => {
    const session = database.getExecutionSession(sessionId);
    if (!session) {
      return null;
    }

    const items = database.getExecutionSessionItems(sessionId);
    const latestResults = new Map<string, LatestScenarioResult>();

    for (const scenarioKey of items
      .map((item) => item.scenarioKey)
      .filter((value, index, array) => array.indexOf(value) === index)) {
      const [latestResult] = database.getScenarioRunHistory(scenarioKey, 1);
      if (latestResult) {
        latestResults.set(scenarioKey, latestResult);
      }
    }

    const sessionItems = items.map((item) => {
      const feature = database.getFeature(item.featureKey);
      const scenario = database.getScenario(item.scenarioKey);
      const metadata = feature
        ? parseJson<FeatureMetadata>(feature.metadataJson, emptyMetadata())
        : emptyMetadata();

      return {
        scenarioId: item.scenarioKey,
        featureId: item.featureKey,
        featureTitle: item.featureTitle,
        scenarioTitle: item.scenarioTitle,
        sortOrder: item.sortOrder,
        sourceLine: item.sourceLine,
        steps: scenario ? parseJson<StepSpec[]>(scenario.stepsJson, []) : [],
        environments: metadata.environments,
        latestResult: latestResults.get(item.scenarioKey) ?? null,
        resolvedStatus: item.resolvedStatus,
        isStale: !item.isScenarioActive
      };
    });

    const nextItem = items.find((item) => item.resolvedStatus === null) ?? null;

    return {
      id: session.id,
      name: session.name,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      totalCount: session.totalCount,
      resolvedCount: session.resolvedCount,
      nextScenarioId: nextItem?.scenarioKey ?? null,
      nextFeatureId: nextItem?.featureKey ?? null,
      filters: parseJson<ExecutionSessionFilters>(session.filtersJson, {
        search: "",
        tag: "",
        environment: "",
        priority: ""
      }),
      items: sessionItems
    };
  };

  const recordScenarioResultInternal = async (
    scenarioId: string,
    input: RecordScenarioResultInput
  ): Promise<LatestScenarioResult> => {
    const scenario = database.getScenario(scenarioId);
    if (!scenario?.isActive) {
      throw new Error(`Scenario not found or inactive: ${scenarioId}`);
    }

    if (!input.testerName.trim()) {
      throw new Error("Tester name is required.");
    }

    const attachmentRefs = (input.attachments ?? []).filter((attachment) =>
      attachment.value.trim()
    );

    return database.recordScenarioRun({
      scenarioKey: scenarioId,
      featureKey: scenario.featureKey,
      testerName: input.testerName.trim(),
      environment: input.environment?.trim() || undefined,
      status: input.status,
      notes: input.notes?.trim() ?? "",
      attachments: attachmentRefs
    });
  };

  const getSharedSyncStatus = async (): Promise<SharedSyncStatusDto> => {
    if (!config.sharedResults) {
      return {
        enabled: false,
        offlineLike: false
      };
    }

    const state = database.getSharedSyncState(config.sharedResults.projectId);
    return {
      enabled: true,
      baseUrl: config.sharedResults.baseUrl,
      projectId: config.sharedResults.projectId,
      lastSyncAt: state?.lastSyncAt ?? undefined,
      lastSyncError: state?.lastSyncError ?? undefined,
      offlineLike: classifyOfflineLike(state?.lastSyncError)
    };
  };

  const exportRunResultsNdjsonInternal =
    async (): Promise<RunResultsExportDto> => {
      const exportedAt = new Date().toISOString();
      const projectId =
        config.sharedResults?.projectId ?? defaultProjectId(config.rootDir);
      const events = database.getRecordedRuns().map((record) =>
        buildSharedRunEvent({
          eventId: record.id,
          projectId,
          featureId: record.featureKey,
          scenarioKey: record.scenarioKey,
          scenarioTitle: record.scenarioTitle,
          runId: record.runId,
          testerName: record.testerName,
          environment: record.environment,
          status: record.status,
          notes: record.notes,
          createdAt: record.createdAt,
          attachments: record.attachments,
          exportedAt
        })
      );

      return {
        projectId,
        exportedAt,
        itemCount: events.length,
        ndjson: stringifySharedRunEventsNdjson(events)
      };
    };

  return {
    config,
    syncSpecsFromFilesystem,
    getSpecsList,
    async getFeatureDetail(featureId) {
      const specFile = database.getSpecFile(featureId);
      if (!specFile) {
        return null;
      }

      const feature = database.getFeature(featureId);
      if (!feature) {
        return {
          featureId,
          title: specFile.displayTitle,
          filePath: specFile.relativePath,
          parseHealth: specFile.parseHealth as ParseHealth,
          issueCount: specFile.issueCount,
          issues: parseJson<ParseIssue[]>(specFile.issuesJson, []),
          metadata: emptyMetadata(),
          description: "",
          background: [],
          scenarioGroups: []
        };
      }

      const latestResultMap = new Map(
        database
          .getFeatureLatestResults(featureId)
          .map((result) => [result.scenarioKey, result] as const)
      );

      const groupedScenarios = new Map<string, ScenarioGroupDto>();
      const scenarios = database.getFeatureScenarios(featureId);

      for (const scenario of scenarios) {
        const group = groupedScenarios.get(scenario.groupKey) ?? {
          id: scenario.groupKey,
          title: scenario.groupTitle,
          description: scenario.description,
          kind: scenario.groupKind,
          aggregateStatus: null,
          cases: []
        };

        const latestResult = latestResultMap.get(scenario.scenarioKey) ?? null;
        group.cases.push({
          id: scenario.scenarioKey,
          scenarioId: scenario.groupKey,
          title: scenario.title,
          description: scenario.description,
          kind: scenario.kind,
          tags: parseJson<string[]>(scenario.tagsJson, []),
          steps: parseJson<StepSpec[]>(scenario.stepsJson, []),
          outlineTitle: scenario.outlineTitle ?? undefined,
          exampleName: scenario.exampleName ?? undefined,
          exampleIndex: scenario.exampleIndex ?? undefined,
          exampleValues: parseJson<Record<string, string> | undefined>(
            scenario.exampleValuesJson,
            undefined
          ),
          location: scenario.sourceLine
            ? { line: scenario.sourceLine }
            : undefined,
          sourceLine: scenario.sourceLine,
          latestResult
        });
        groupedScenarios.set(scenario.groupKey, group);
      }

      const scenarioGroups = [...groupedScenarios.values()].map((group) => ({
        ...group,
        aggregateStatus: summarizeLatestStatuses(
          group.cases.flatMap((scenario) =>
            scenario.latestResult ? [scenario.latestResult] : []
          )
        ).aggregate
      }));

      return {
        featureId,
        title: feature.displayTitle,
        featureTitle: feature.featureTitle,
        filePath: feature.specRelativePath,
        parseHealth: feature.parseHealth as ParseHealth,
        issueCount: feature.issueCount,
        issues: parseJson<ParseIssue[]>(specFile.issuesJson, []),
        metadata: parseJson<FeatureMetadata>(
          feature.metadataJson,
          emptyMetadata()
        ),
        description: feature.description,
        background: parseJson<StepSpec[]>(feature.backgroundJson, []),
        scenarioGroups
      };
    },
    async getScenarioHistory(scenarioId) {
      const scenario = database.getScenario(scenarioId);
      if (!scenario) {
        return null;
      }

      let sharedHistory: SharedRunEvent[] = [];
      let sharedHistoryError: string | undefined;
      const syncStatus = await getSharedSyncStatus();

      if (config.sharedResults) {
        try {
          sharedHistory = await fetchSharedScenarioResults(
            config.sharedResults,
            scenarioId
          );
        } catch (error) {
          sharedHistoryError =
            error instanceof Error
              ? error.message
              : "Failed to load shared scenario history.";
        }
      }

      const history = database.getScenarioRunHistory(scenarioId);

      return {
        scenarioId,
        scenarioTitle: scenario.title,
        featureId: scenario.featureKey,
        history,
        sharedHistoryEnabled: Boolean(config.sharedResults),
        sharedHistory,
        delta: buildScenarioSharedDelta(
          history[0] ?? null,
          sharedHistory[0] ?? null
        ),
        syncStatus,
        sharedHistoryError
      };
    },
    exportRunResultsNdjson: exportRunResultsNdjsonInternal,
    getSharedSyncStatus,
    async syncSharedResults() {
      if (!config.sharedResults) {
        throw new Error("Shared results are not configured.");
      }

      const attemptAt = new Date().toISOString();
      const exported = await exportRunResultsNdjsonInternal();

      try {
        const imported = await importSharedRunEvents(
          config.sharedResults,
          exported.ndjson
        );
        const syncedAt = new Date().toISOString();
        database.upsertSharedSyncState({
          projectId: config.sharedResults.projectId,
          lastSyncAt: syncedAt,
          lastSyncError: null,
          lastAttemptAt: attemptAt
        });

        return {
          acceptedCount: imported.acceptedCount,
          exportedCount: exported.itemCount,
          syncedAt
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to sync shared results.";
        database.upsertSharedSyncState({
          projectId: config.sharedResults.projectId,
          lastSyncAt:
            database.getSharedSyncState(config.sharedResults.projectId)
              ?.lastSyncAt ?? null,
          lastSyncError: message,
          lastAttemptAt: attemptAt
        });
        throw new Error(message);
      }
    },
    recordScenarioResult: recordScenarioResultInternal,
    async createExecutionSession(input) {
      const selectedScenarioIds = new Set(input.scenarioIds ?? []);
      const specs = await getSpecsList();
      const matchingSpecs = specs.filter((item) =>
        matchesSpecsFilters(item, input.filters)
      );

      const items = matchingSpecs.flatMap((spec) =>
        database.getFeatureScenarios(spec.featureId).map((scenario) => ({
          scenarioKey: scenario.scenarioKey,
          featureKey: scenario.featureKey,
          featureTitle: spec.title,
          scenarioTitle: scenario.title,
          sourceLine: scenario.sourceLine,
          exampleIndex: scenario.exampleIndex,
          sortOrder: scenario.sortOrder
        }))
      );

      const filteredItems =
        selectedScenarioIds.size > 0
          ? items.filter((item) => selectedScenarioIds.has(item.scenarioKey))
          : items;

      const sortedItems = filteredItems
        .sort(compareSessionItems)
        .map((item, index) => ({
          ...item,
          sortOrder: index + 1
        }));

      if (sortedItems.length === 0) {
        throw new Error("No scenarios matched the current filters.");
      }

      const createdAt = new Date();
      const session = database.createExecutionSession({
        name:
          input.name?.trim() ||
          buildExecutionSessionName(createdAt, input.filters),
        filtersJson: JSON.stringify(input.filters),
        items: sortedItems
      });

      const detail = await getExecutionSessionDetail(session.id);
      if (!detail) {
        throw new Error(`Failed to load execution session: ${session.id}`);
      }

      return detail;
    },
    async getExecutionSessions() {
      const sessions = database.getExecutionSessions();
      const itemGroups = new Map(
        sessions.map(
          (session) =>
            [session.id, database.getExecutionSessionItems(session.id)] as const
        )
      );

      return sessions.map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        totalCount: session.totalCount,
        resolvedCount: session.resolvedCount,
        nextScenarioId: session.nextScenarioKey,
        nextFeatureId:
          itemGroups
            .get(session.id)
            ?.find((item) => item.scenarioKey === session.nextScenarioKey)
            ?.featureKey ?? null
      }));
    },
    getExecutionSession: getExecutionSessionDetail,
    async recordSessionScenarioResult(sessionId, scenarioId, input) {
      const result = await recordScenarioResultInternal(scenarioId, input);
      database.linkSessionScenarioResult(sessionId, scenarioId, result);
      return result;
    },
    getHealth() {
      return {
        ok: true,
        config: {
          rootDir: config.rootDir,
          specDir: config.specDir,
          dbPath: config.dbPath,
          evidenceDir: config.evidenceDir,
          autoScan: config.autoScan,
          sharedResults: config.sharedResults
        }
      };
    },
    async close() {
      if (syncTimeout) {
        clearTimeout(syncTimeout);
      }
      if (watcher) {
        await watcher.close();
      }
      database.close();
    }
  };
}

function emptyMetadata(): FeatureMetadata {
  return {
    environments: [],
    tags: [],
    related: [],
    extra: {}
  };
}

function buildScenarioSharedDelta(
  localLatest: LatestScenarioResult | null,
  sharedLatest: SharedRunEvent | null
): ScenarioSharedDeltaDto {
  if (!localLatest && !sharedLatest) {
    return {
      localLatest,
      sharedLatest,
      state: "in-sync",
      summaryLabel: "No local or shared results yet."
    };
  }

  if (localLatest && !sharedLatest) {
    return {
      localLatest,
      sharedLatest,
      state: "local-only",
      summaryLabel: "Local result not shared yet."
    };
  }

  if (!localLatest && sharedLatest) {
    return {
      localLatest,
      sharedLatest,
      state: "shared-newer",
      summaryLabel: "Shared result is newer than local history."
    };
  }

  if (
    localLatest &&
    sharedLatest &&
    areResultsEquivalent(localLatest, sharedLatest)
  ) {
    return {
      localLatest,
      sharedLatest,
      state: "in-sync",
      summaryLabel: "Local and shared latest results are in sync."
    };
  }

  if (
    localLatest &&
    sharedLatest &&
    new Date(sharedLatest.createdAt).getTime() >
      new Date(localLatest.createdAt).getTime()
  ) {
    return {
      localLatest,
      sharedLatest,
      state: "shared-newer",
      summaryLabel: "Shared result is newer."
    };
  }

  return {
    localLatest,
    sharedLatest,
    state: "different",
    summaryLabel: "Local and shared latest results differ."
  };
}

function areResultsEquivalent(
  localLatest: LatestScenarioResult,
  sharedLatest: SharedRunEvent
): boolean {
  return (
    localLatest.createdAt === sharedLatest.createdAt &&
    localLatest.status === sharedLatest.status &&
    localLatest.testerName === sharedLatest.testerName &&
    localLatest.environment === sharedLatest.environment &&
    localLatest.notes === sharedLatest.notes
  );
}

function classifyOfflineLike(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) {
    return false;
  }

  return (
    /fetch failed|network|enotfound|econnrefused|timed out/i.test(
      errorMessage
    ) || /request failed with 5\d\d/i.test(errorMessage)
  );
}

function matchesSpecsFilters(
  item: SpecsListItemDto,
  filters: ExecutionSessionFilters
): boolean {
  const query = filters.search.trim().toLowerCase();
  const matchesSearch =
    query.length === 0 ||
    [
      item.title,
      item.featureTitle,
      item.filePath,
      item.metadata.owner,
      ...item.metadata.tags,
      ...item.metadata.related
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(query));

  const matchesTag =
    filters.tag === "" || item.metadata.tags.includes(filters.tag);
  const matchesEnvironment =
    filters.environment === "" ||
    item.metadata.environments.includes(filters.environment);
  const matchesPriority =
    filters.priority === "" || item.metadata.priority === filters.priority;

  return matchesSearch && matchesTag && matchesEnvironment && matchesPriority;
}

function compareSessionItems(
  left: {
    featureKey: string;
    sortOrder: number;
    exampleIndex?: number | null;
    scenarioTitle: string;
  },
  right: {
    featureKey: string;
    sortOrder: number;
    exampleIndex?: number | null;
    scenarioTitle: string;
  }
): number {
  return (
    left.featureKey.localeCompare(right.featureKey) ||
    left.sortOrder - right.sortOrder ||
    (left.exampleIndex ?? 0) - (right.exampleIndex ?? 0) ||
    left.scenarioTitle.localeCompare(right.scenarioTitle)
  );
}

function buildExecutionSessionName(
  createdAt: Date,
  filters: ExecutionSessionFilters
): string {
  const activeFilters = [
    filters.tag && `tag:${filters.tag}`,
    filters.environment && `environment:${filters.environment}`,
    filters.priority && `priority:${filters.priority}`,
    filters.search.trim() && `search:${filters.search.trim()}`
  ].filter(Boolean);

  const stamp = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(createdAt);

  return activeFilters.length > 0
    ? `Session ${stamp} (${activeFilters.join(", ")})`
    : `Session ${stamp}`;
}

export type {
  LatestScenarioResult,
  ParseIssue,
  RunStatus
} from "@spexor/domain";
export type { SpexorDatabase };
