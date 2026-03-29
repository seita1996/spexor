import fs from "node:fs/promises";
import { loadConfig, type ResolvedSpexorConfig } from "@spexor/config";
import { initDatabase, parseJson, type SpexorDatabase } from "@spexor/db";
import {
  type EvidenceRef,
  type FeatureMetadata,
  type LatestScenarioResult,
  type ParseHealth,
  type ParseIssue,
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
  browser?: string | undefined;
  platform?: string | undefined;
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
  sharedHistoryError?: string | undefined;
}

export interface RunResultsExportDto {
  projectId: string;
  exportedAt: string;
  itemCount: number;
  ndjson: string;
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
  recordScenarioResult(
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

  return {
    config,
    syncSpecsFromFilesystem,
    async getSpecsList() {
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
    },
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

      return {
        scenarioId,
        scenarioTitle: scenario.title,
        featureId: scenario.featureKey,
        history: database.getScenarioRunHistory(scenarioId),
        sharedHistoryEnabled: Boolean(config.sharedResults),
        sharedHistory,
        sharedHistoryError
      };
    },
    async exportRunResultsNdjson() {
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
          browser: record.browser,
          platform: record.platform,
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
    },
    async recordScenarioResult(scenarioId, input) {
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
        browser: input.browser?.trim() || undefined,
        platform: input.platform?.trim() || undefined,
        status: input.status,
        notes: input.notes?.trim() ?? "",
        attachments: attachmentRefs
      });
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
    browsers: [],
    platforms: [],
    tags: [],
    related: [],
    extra: {}
  };
}

export type {
  LatestScenarioResult,
  ParseIssue,
  RunStatus
} from "@spexor/domain";
export type { SpexorDatabase };
