import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync
} from "node:sqlite";
import {
  type EvidenceRef,
  expandFeatureCases,
  type FeatureSpec,
  type LatestScenarioResult,
  normalizePath,
  type ParsedSpecFile,
  type RunStatus,
  type ScenarioCaseSpec,
  type StepSpec
} from "@spexor/domain";

export interface SpecFileRecord {
  relativePath: string;
  absolutePath: string;
  contentHash: string;
  parseHealth: string;
  issueCount: number;
  issuesJson: string;
  displayTitle: string;
  scannedAt: string;
  isActive: boolean;
}

export interface FeatureRecord {
  featureKey: string;
  specRelativePath: string;
  featureTitle: string;
  displayTitle: string;
  description: string;
  metadataJson: string;
  backgroundJson: string;
  sourceLine: number | null;
  parseHealth: string;
  issueCount: number;
  isActive: boolean;
  syncedAt: string;
}

export interface ScenarioRecord {
  scenarioKey: string;
  featureKey: string;
  groupKey: string;
  groupTitle: string;
  title: string;
  description: string;
  kind: "scenario" | "outline-example";
  groupKind: "scenario" | "outline";
  outlineTitle: string | null;
  exampleName: string | null;
  exampleIndex: number | null;
  exampleValuesJson: string | null;
  stepsJson: string;
  tagsJson: string;
  sourceLine: number | null;
  sortOrder: number;
  isActive: boolean;
  syncedAt: string;
}

export interface ScenarioLatestResultRecord extends LatestScenarioResult {
  scenarioKey: string;
}

export interface ScenarioHistoryEntry extends LatestScenarioResult {
  scenarioKey: string;
}

export interface RecordedRunRecord extends LatestScenarioResult {
  scenarioKey: string;
  featureKey: string;
  scenarioTitle: string;
}

export interface ExecutionSessionRecord {
  id: string;
  name: string;
  status: "active" | "completed";
  createdAt: string;
  completedAt: string | null;
  filtersJson: string;
  totalCount: number;
}

export interface ExecutionSessionItemRecord {
  sessionId: string;
  scenarioKey: string;
  featureKey: string;
  featureTitle: string;
  scenarioTitle: string;
  sourceLine: number | null;
  exampleIndex: number | null;
  sortOrder: number;
  latestRunResultId: string | null;
  resolvedStatus: RunStatus | null;
  resolvedAt: string | null;
  isScenarioActive: boolean;
}

export interface SharedSyncStateRecord {
  projectId: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastAttemptAt: string | null;
}

export interface RecordScenarioRunInput {
  scenarioKey: string;
  featureKey: string;
  testerName: string;
  environment?: string | undefined;
  status: RunStatus;
  notes?: string | undefined;
  attachments: EvidenceRef[];
}

export interface CreateExecutionSessionInput {
  name: string;
  filtersJson: string;
  items: Array<{
    scenarioKey: string;
    featureKey: string;
    featureTitle: string;
    scenarioTitle: string;
    sourceLine?: number | null;
    exampleIndex?: number | null;
    sortOrder: number;
  }>;
}

export interface SpexorDatabase {
  close(): void;
  saveParsedSpecs(parsedFiles: ParsedSpecFile[]): { processedCount: number };
  getSpecFiles(): SpecFileRecord[];
  getSpecFile(relativePath: string): SpecFileRecord | null;
  getFeature(relativePath: string): FeatureRecord | null;
  getSpecsOverview(): Array<SpecFileRecord & { scenarioCount: number }>;
  getFeatureScenarios(relativePath: string): ScenarioRecord[];
  getScenario(relativePath: string): ScenarioRecord | null;
  getFeatureLatestResults(relativePath: string): ScenarioLatestResultRecord[];
  getFeatureLatestResultsByEnvironment(
    relativePath: string
  ): LatestScenarioResult[];
  getScenarioRunHistory(
    scenarioKey: string,
    limit?: number
  ): ScenarioHistoryEntry[];
  getRecordedRuns(limit?: number): RecordedRunRecord[];
  recordScenarioRun(input: RecordScenarioRunInput): ScenarioHistoryEntry;
  createExecutionSession(
    input: CreateExecutionSessionInput
  ): ExecutionSessionRecord;
  getExecutionSessions(): Array<
    ExecutionSessionRecord & {
      resolvedCount: number;
      nextScenarioKey: string | null;
    }
  >;
  getExecutionSession(sessionId: string):
    | (ExecutionSessionRecord & {
        resolvedCount: number;
      })
    | null;
  getExecutionSessionItems(sessionId: string): ExecutionSessionItemRecord[];
  linkSessionScenarioResult(
    sessionId: string,
    scenarioKey: string,
    result: LatestScenarioResult
  ): void;
  getSharedSyncState(projectId: string): SharedSyncStateRecord | null;
  upsertSharedSyncState(input: SharedSyncStateRecord): SharedSyncStateRecord;
}

interface SpecFileRow {
  relative_path: unknown;
  absolute_path: unknown;
  content_hash: unknown;
  parse_health: unknown;
  issue_count: unknown;
  issues_json: unknown;
  display_title: unknown;
  scanned_at: unknown;
  is_active: unknown;
}

interface FeatureRow {
  feature_key: unknown;
  spec_relative_path: unknown;
  feature_title: unknown;
  display_title: unknown;
  description: unknown;
  metadata_json: unknown;
  background_json: unknown;
  source_line: unknown;
  parse_health: unknown;
  issue_count: unknown;
  is_active: unknown;
  synced_at: unknown;
}

interface ScenarioRow {
  scenario_key: unknown;
  feature_key: unknown;
  group_key: unknown;
  group_title: unknown;
  title: unknown;
  description: unknown;
  kind: unknown;
  group_kind: unknown;
  outline_title: unknown;
  example_name: unknown;
  example_index: unknown;
  example_values_json: unknown;
  steps_json: unknown;
  tags_json: unknown;
  source_line: unknown;
  sort_order: unknown;
  is_active: unknown;
  synced_at: unknown;
}

interface LatestResultRow {
  result_id: unknown;
  run_id: unknown;
  scenario_key: unknown;
  feature_key: unknown;
  scenario_title: unknown;
  status: unknown;
  notes: unknown;
  created_at: unknown;
  tester_name: unknown;
  environment: unknown;
  browser: unknown;
  platform: unknown;
}

interface AttachmentRow {
  run_result_id: unknown;
  kind: unknown;
  value: unknown;
  label: unknown;
}

interface ExecutionSessionRow {
  id: unknown;
  name: unknown;
  status: unknown;
  created_at: unknown;
  completed_at: unknown;
  filters_json: unknown;
  total_count: unknown;
}

interface ExecutionSessionSummaryRow extends ExecutionSessionRow {
  resolved_count: unknown;
  next_scenario_key: unknown;
}

interface ExecutionSessionItemRow {
  session_id: unknown;
  scenario_key: unknown;
  feature_key: unknown;
  feature_title: unknown;
  scenario_title: unknown;
  source_line: unknown;
  example_index: unknown;
  sort_order: unknown;
  latest_run_result_id: unknown;
  resolved_status: unknown;
  resolved_at: unknown;
  scenario_active: unknown;
}

interface SharedSyncStateRow {
  project_id: unknown;
  last_sync_at: unknown;
  last_sync_error: unknown;
  last_attempt_at: unknown;
}

type SpecOverviewRow = SpecFileRow & { scenario_count: unknown };

const schema = `
  CREATE TABLE IF NOT EXISTS spec_files (
    relative_path TEXT PRIMARY KEY,
    absolute_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    parse_health TEXT NOT NULL,
    issue_count INTEGER NOT NULL,
    issues_json TEXT NOT NULL,
    display_title TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS features (
    feature_key TEXT PRIMARY KEY,
    spec_relative_path TEXT NOT NULL,
    feature_title TEXT NOT NULL,
    display_title TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    background_json TEXT NOT NULL,
    source_line INTEGER,
    parse_health TEXT NOT NULL,
    issue_count INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    synced_at TEXT NOT NULL,
    FOREIGN KEY (spec_relative_path) REFERENCES spec_files(relative_path)
  );

  CREATE TABLE IF NOT EXISTS scenarios (
    scenario_key TEXT PRIMARY KEY,
    feature_key TEXT NOT NULL,
    group_key TEXT NOT NULL,
    group_title TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    group_kind TEXT NOT NULL,
    outline_title TEXT,
    example_name TEXT,
    example_index INTEGER,
    example_values_json TEXT,
    steps_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    source_line INTEGER,
    sort_order INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    synced_at TEXT NOT NULL,
    FOREIGN KEY (feature_key) REFERENCES features(feature_key)
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    scenario_key TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    tester_name TEXT NOT NULL,
    environment TEXT,
    browser TEXT,
    platform TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS run_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    scenario_key TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id)
  );

  CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    run_result_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_result_id) REFERENCES run_results(id)
  );

  CREATE TABLE IF NOT EXISTS execution_sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    filters_json TEXT NOT NULL,
    total_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execution_session_items (
    session_id TEXT NOT NULL,
    scenario_key TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    feature_title TEXT NOT NULL,
    scenario_title TEXT NOT NULL,
    source_line INTEGER,
    example_index INTEGER,
    sort_order INTEGER NOT NULL,
    latest_run_result_id TEXT,
    resolved_status TEXT,
    resolved_at TEXT,
    PRIMARY KEY (session_id, scenario_key),
    FOREIGN KEY (session_id) REFERENCES execution_sessions(id),
    FOREIGN KEY (latest_run_result_id) REFERENCES run_results(id)
  );

  CREATE TABLE IF NOT EXISTS shared_sync_state (
    project_id TEXT PRIMARY KEY,
    last_sync_at TEXT,
    last_sync_error TEXT,
    last_attempt_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_spec_files_active ON spec_files(is_active);
  CREATE INDEX IF NOT EXISTS idx_features_active ON features(is_active);
  CREATE INDEX IF NOT EXISTS idx_scenarios_feature_active ON scenarios(feature_key, is_active, sort_order);
  CREATE INDEX IF NOT EXISTS idx_run_results_scenario_created ON run_results(scenario_key, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_attachments_run_result ON attachments(run_result_id);
  CREATE INDEX IF NOT EXISTS idx_execution_sessions_status_created ON execution_sessions(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_execution_session_items_session_order ON execution_session_items(session_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_shared_sync_state_attempt ON shared_sync_state(last_attempt_at DESC);
`;

export function initDatabase(dbPath: string): SpexorDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);
  ensureRunsEnvironmentColumn(database);

  const upsertSpecFile = database.prepare(`
    INSERT INTO spec_files (
      relative_path, absolute_path, content_hash, parse_health, issue_count, issues_json, display_title, scanned_at, is_active
    ) VALUES (
      @relative_path, @absolute_path, @content_hash, @parse_health, @issue_count, @issues_json, @display_title, @scanned_at, 1
    )
    ON CONFLICT(relative_path) DO UPDATE SET
      absolute_path = excluded.absolute_path,
      content_hash = excluded.content_hash,
      parse_health = excluded.parse_health,
      issue_count = excluded.issue_count,
      issues_json = excluded.issues_json,
      display_title = excluded.display_title,
      scanned_at = excluded.scanned_at,
      is_active = 1
  `);

  const upsertFeature = database.prepare(`
    INSERT INTO features (
      feature_key, spec_relative_path, feature_title, display_title, description, metadata_json, background_json,
      source_line, parse_health, issue_count, is_active, synced_at
    ) VALUES (
      @feature_key, @spec_relative_path, @feature_title, @display_title, @description, @metadata_json, @background_json,
      @source_line, @parse_health, @issue_count, 1, @synced_at
    )
    ON CONFLICT(feature_key) DO UPDATE SET
      spec_relative_path = excluded.spec_relative_path,
      feature_title = excluded.feature_title,
      display_title = excluded.display_title,
      description = excluded.description,
      metadata_json = excluded.metadata_json,
      background_json = excluded.background_json,
      source_line = excluded.source_line,
      parse_health = excluded.parse_health,
      issue_count = excluded.issue_count,
      is_active = 1,
      synced_at = excluded.synced_at
  `);

  const upsertScenario = database.prepare(`
    INSERT INTO scenarios (
      scenario_key, feature_key, group_key, group_title, title, description, kind, group_kind, outline_title,
      example_name, example_index, example_values_json, steps_json, tags_json, source_line, sort_order, is_active, synced_at
    ) VALUES (
      @scenario_key, @feature_key, @group_key, @group_title, @title, @description, @kind, @group_kind, @outline_title,
      @example_name, @example_index, @example_values_json, @steps_json, @tags_json, @source_line, @sort_order, 1, @synced_at
    )
    ON CONFLICT(scenario_key) DO UPDATE SET
      feature_key = excluded.feature_key,
      group_key = excluded.group_key,
      group_title = excluded.group_title,
      title = excluded.title,
      description = excluded.description,
      kind = excluded.kind,
      group_kind = excluded.group_kind,
      outline_title = excluded.outline_title,
      example_name = excluded.example_name,
      example_index = excluded.example_index,
      example_values_json = excluded.example_values_json,
      steps_json = excluded.steps_json,
      tags_json = excluded.tags_json,
      source_line = excluded.source_line,
      sort_order = excluded.sort_order,
      is_active = 1,
      synced_at = excluded.synced_at
  `);

  const deactivateMissing = (relativePaths: string[]) => {
    const activeFlag =
      relativePaths.length === 0
        ? ""
        : `WHERE relative_path NOT IN (${relativePaths.map(() => "?").join(", ")})`;
    database
      .prepare(`UPDATE spec_files SET is_active = 0 ${activeFlag}`)
      .run(...relativePaths);
    const featureFlag =
      relativePaths.length === 0
        ? ""
        : `WHERE feature_key NOT IN (${relativePaths.map(() => "?").join(", ")})`;
    database
      .prepare(`UPDATE features SET is_active = 0 ${featureFlag}`)
      .run(...relativePaths);
    database
      .prepare(`UPDATE scenarios SET is_active = 0 ${featureFlag}`)
      .run(...relativePaths);
  };

  const saveParsedSpecsTransaction = (parsedFiles: ParsedSpecFile[]) =>
    runTransaction(database, () => {
      const now = new Date().toISOString();
      deactivateMissing(parsedFiles.map((file) => file.relativePath));

      for (const parsedFile of parsedFiles) {
        upsertSpecFile.run({
          relative_path: parsedFile.relativePath,
          absolute_path: normalizePath(parsedFile.filePath),
          content_hash: parsedFile.contentHash,
          parse_health: parsedFile.parseHealth,
          issue_count: parsedFile.issues.length,
          issues_json: JSON.stringify(parsedFile.issues),
          display_title: getDisplayTitle(parsedFile),
          scanned_at: now
        });

        if (!parsedFile.feature) {
          database
            .prepare(
              "UPDATE features SET is_active = 0, synced_at = ? WHERE feature_key = ?"
            )
            .run(now, parsedFile.relativePath);
          database
            .prepare(
              "UPDATE scenarios SET is_active = 0, synced_at = ? WHERE feature_key = ?"
            )
            .run(now, parsedFile.relativePath);
          continue;
        }

        saveFeatureSnapshot(
          database,
          upsertFeature,
          upsertScenario,
          parsedFile.feature,
          parsedFile.issues.length,
          parsedFile.parseHealth,
          now
        );
      }
    });

  const getScenarioRunHistory = (
    scenarioKey: string,
    limit = 20
  ): ScenarioHistoryEntry[] => {
    const rows = database
      .prepare(`
        SELECT
          rr.id AS result_id,
          rr.run_id,
          rr.scenario_key,
          runs.feature_key,
          COALESCE(s.title, rr.scenario_key) AS scenario_title,
          rr.status,
          rr.notes,
          rr.created_at,
          runs.tester_name,
          COALESCE(runs.environment, CASE
            WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
            ELSE COALESCE(runs.platform, runs.browser)
          END) AS environment,
          runs.browser,
          runs.platform
        FROM run_results rr
        INNER JOIN runs ON runs.id = rr.run_id
        LEFT JOIN scenarios s ON s.scenario_key = rr.scenario_key
        WHERE rr.scenario_key = ?
        ORDER BY rr.created_at DESC
        LIMIT ?
      `)
      .all(scenarioKey, limit) as unknown as LatestResultRow[];

    const attachmentMap = getAttachmentsForResultIds(
      database,
      rows.map((row) => String(row.result_id))
    );

    return rows.map((row) => ({
      scenarioKey,
      ...toLatestResultRecord(
        row,
        attachmentMap.get(String(row.result_id)) ?? []
      )
    }));
  };

  return {
    close() {
      database.close();
    },
    saveParsedSpecs(parsedFiles) {
      saveParsedSpecsTransaction(parsedFiles);
      return { processedCount: parsedFiles.length };
    },
    getSpecFiles() {
      const rows = database
        .prepare(
          "SELECT * FROM spec_files WHERE is_active = 1 ORDER BY relative_path"
        )
        .all() as unknown as SpecFileRow[];
      return rows.map(toSpecFileRecord);
    },
    getSpecFile(relativePath) {
      const row = database
        .prepare("SELECT * FROM spec_files WHERE relative_path = ? LIMIT 1")
        .get(relativePath) as unknown as SpecFileRow | undefined;
      return row ? toSpecFileRecord(row) : null;
    },
    getFeature(relativePath) {
      const row = database
        .prepare(
          "SELECT * FROM features WHERE feature_key = ? AND is_active = 1 LIMIT 1"
        )
        .get(relativePath) as unknown as FeatureRow | undefined;
      return row ? toFeatureRecord(row) : null;
    },
    getSpecsOverview() {
      const rows = database
        .prepare(`
          SELECT sf.*, COUNT(s.scenario_key) AS scenario_count
          FROM spec_files sf
          LEFT JOIN scenarios s ON s.feature_key = sf.relative_path AND s.is_active = 1
          WHERE sf.is_active = 1
          GROUP BY sf.relative_path
          ORDER BY sf.relative_path
        `)
        .all() as unknown as SpecOverviewRow[];

      return rows.map((row) => ({
        ...toSpecFileRecord(row),
        scenarioCount: Number(row.scenario_count ?? 0)
      }));
    },
    getFeatureScenarios(relativePath) {
      const rows = database
        .prepare(
          "SELECT * FROM scenarios WHERE feature_key = ? AND is_active = 1 ORDER BY sort_order ASC"
        )
        .all(relativePath) as unknown as ScenarioRow[];
      return rows.map(toScenarioRecord);
    },
    getScenario(scenarioKey) {
      const row = database
        .prepare("SELECT * FROM scenarios WHERE scenario_key = ? LIMIT 1")
        .get(scenarioKey) as unknown as ScenarioRow | undefined;
      return row ? toScenarioRecord(row) : null;
    },
    getFeatureLatestResults(relativePath) {
      const rows = database
        .prepare(`
          SELECT
            s.scenario_key,
            rr.id AS result_id,
            rr.run_id,
            rr.status,
            rr.notes,
            rr.created_at,
            runs.tester_name,
            COALESCE(runs.environment, CASE
              WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
              ELSE COALESCE(runs.platform, runs.browser)
            END) AS environment,
            runs.browser,
            runs.platform
          FROM scenarios s
          LEFT JOIN run_results rr
            ON rr.id = (
              SELECT rr2.id
              FROM run_results rr2
              WHERE rr2.scenario_key = s.scenario_key
              ORDER BY rr2.created_at DESC
              LIMIT 1
            )
          LEFT JOIN runs ON runs.id = rr.run_id
          WHERE s.feature_key = ? AND s.is_active = 1 AND rr.id IS NOT NULL
          ORDER BY s.sort_order ASC
        `)
        .all(relativePath) as unknown as LatestResultRow[];

      const attachmentMap = getAttachmentsForResultIds(
        database,
        rows.map((row) => String(row.result_id))
      );

      return rows.map((row) => ({
        scenarioKey: String(row.scenario_key),
        ...toLatestResultRecord(
          row,
          attachmentMap.get(String(row.result_id)) ?? []
        )
      }));
    },
    getFeatureLatestResultsByEnvironment(relativePath) {
      const rows = database
        .prepare(`
          SELECT
            latest.result_id,
            latest.run_id,
            latest.scenario_key,
            latest.feature_key,
            latest.scenario_title,
            latest.status,
            latest.notes,
            latest.created_at,
            latest.tester_name,
            latest.environment,
            latest.browser,
            latest.platform
          FROM (
            SELECT
              rr.id AS result_id,
              rr.run_id,
              rr.scenario_key,
              runs.feature_key,
              COALESCE(s.title, rr.scenario_key) AS scenario_title,
              rr.status,
              rr.notes,
              rr.created_at,
              runs.tester_name,
              COALESCE(runs.environment, CASE
                WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
                ELSE COALESCE(runs.platform, runs.browser)
              END) AS environment,
              runs.browser,
              runs.platform,
              ROW_NUMBER() OVER (
                PARTITION BY COALESCE(runs.environment, CASE
                  WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
                  ELSE COALESCE(runs.platform, runs.browser)
                END)
                ORDER BY rr.created_at DESC
              ) AS environment_rank
            FROM run_results rr
            INNER JOIN runs ON runs.id = rr.run_id
            LEFT JOIN scenarios s ON s.scenario_key = rr.scenario_key
            WHERE runs.feature_key = ?
              AND COALESCE(runs.environment, CASE
                WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
                ELSE COALESCE(runs.platform, runs.browser)
              END) IS NOT NULL
          ) AS latest
          WHERE latest.environment_rank = 1
          ORDER BY latest.environment ASC
        `)
        .all(relativePath) as unknown as LatestResultRow[];

      const attachmentMap = getAttachmentsForResultIds(
        database,
        rows.map((row) => String(row.result_id))
      );

      return rows.map((row) =>
        toLatestResultRecord(
          row,
          attachmentMap.get(String(row.result_id)) ?? []
        )
      );
    },
    getScenarioRunHistory,
    getRecordedRuns(limit = 500) {
      const rows = database
        .prepare(`
          SELECT
            rr.id AS result_id,
            rr.run_id,
            rr.scenario_key,
            runs.feature_key,
            COALESCE(s.title, rr.scenario_key) AS scenario_title,
            rr.status,
            rr.notes,
            rr.created_at,
            runs.tester_name,
            COALESCE(runs.environment, CASE
              WHEN runs.platform IS NOT NULL AND runs.browser IS NOT NULL THEN runs.platform || '-' || runs.browser
              ELSE COALESCE(runs.platform, runs.browser)
            END) AS environment,
            runs.browser,
            runs.platform
          FROM run_results rr
          INNER JOIN runs ON runs.id = rr.run_id
          LEFT JOIN scenarios s ON s.scenario_key = rr.scenario_key
          ORDER BY rr.created_at DESC
          LIMIT ?
        `)
        .all(limit) as unknown as LatestResultRow[];

      const attachmentMap = getAttachmentsForResultIds(
        database,
        rows.map((row) => String(row.result_id))
      );

      return rows.map((row) => ({
        scenarioKey: String(row.scenario_key),
        featureKey: String(row.feature_key),
        scenarioTitle: String(row.scenario_title),
        ...toLatestResultRecord(
          row,
          attachmentMap.get(String(row.result_id)) ?? []
        )
      }));
    },
    recordScenarioRun(input) {
      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const resultId = crypto.randomUUID();

      runTransaction(database, () => {
        database
          .prepare(`
            INSERT INTO runs (id, scenario_key, feature_key, tester_name, environment, browser, platform, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
          `)
          .run(
            runId,
            input.scenarioKey,
            input.featureKey,
            input.testerName,
            input.environment ?? null,
            now
          );

        database
          .prepare(`
            INSERT INTO run_results (id, run_id, scenario_key, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .run(
            resultId,
            runId,
            input.scenarioKey,
            input.status,
            input.notes ?? "",
            now
          );

        const insertAttachment = database.prepare(`
          INSERT INTO attachments (id, run_result_id, kind, value, label, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const attachment of input.attachments) {
          insertAttachment.run(
            crypto.randomUUID(),
            resultId,
            attachment.kind,
            attachment.value,
            attachment.label ?? null,
            now
          );
        }
      });

      const [latestRecord] = getScenarioRunHistory(input.scenarioKey, 1);
      if (!latestRecord) {
        throw new Error(
          `Failed to load recorded scenario run: ${input.scenarioKey}`
        );
      }

      return latestRecord;
    },
    createExecutionSession(input) {
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      runTransaction(database, () => {
        database
          .prepare(`
            INSERT INTO execution_sessions (
              id, name, status, created_at, completed_at, filters_json, total_count
            ) VALUES (?, ?, 'active', ?, NULL, ?, ?)
          `)
          .run(
            sessionId,
            input.name,
            now,
            input.filtersJson,
            input.items.length
          );

        const insertItem = database.prepare(`
          INSERT INTO execution_session_items (
            session_id, scenario_key, feature_key, feature_title, scenario_title,
            source_line, example_index, sort_order, latest_run_result_id,
            resolved_status, resolved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
        `);

        for (const item of input.items) {
          insertItem.run(
            sessionId,
            item.scenarioKey,
            item.featureKey,
            item.featureTitle,
            item.scenarioTitle,
            item.sourceLine ?? null,
            item.exampleIndex ?? null,
            item.sortOrder
          );
        }
      });

      const session = this.getExecutionSession(sessionId);
      if (!session) {
        throw new Error(`Failed to load execution session: ${sessionId}`);
      }

      return session;
    },
    getExecutionSessions() {
      const rows = database
        .prepare(`
          SELECT
            s.*,
            COALESCE(
              (
                SELECT COUNT(*)
                FROM execution_session_items items
                WHERE items.session_id = s.id
                  AND items.resolved_status IS NOT NULL
              ),
              0
            ) AS resolved_count,
            (
              SELECT items.scenario_key
              FROM execution_session_items items
              WHERE items.session_id = s.id
                AND items.resolved_status IS NULL
              ORDER BY items.sort_order ASC
              LIMIT 1
            ) AS next_scenario_key
          FROM execution_sessions s
          ORDER BY s.created_at DESC
        `)
        .all() as unknown as ExecutionSessionSummaryRow[];

      return rows.map(toExecutionSessionSummaryRecord);
    },
    getExecutionSession(sessionId) {
      const row = database
        .prepare(`
          SELECT
            s.*,
            COALESCE(
              (
                SELECT COUNT(*)
                FROM execution_session_items items
                WHERE items.session_id = s.id
                  AND items.resolved_status IS NOT NULL
              ),
              0
            ) AS resolved_count,
            NULL AS next_scenario_key
          FROM execution_sessions s
          WHERE s.id = ?
          LIMIT 1
        `)
        .get(sessionId) as unknown as ExecutionSessionSummaryRow | undefined;
      return row ? toExecutionSessionSummaryRecord(row) : null;
    },
    getExecutionSessionItems(sessionId) {
      const rows = database
        .prepare(`
          SELECT
            items.*,
            COALESCE(s.is_active, 0) AS scenario_active
          FROM execution_session_items items
          LEFT JOIN scenarios s ON s.scenario_key = items.scenario_key
          WHERE items.session_id = ?
          ORDER BY items.sort_order ASC
        `)
        .all(sessionId) as unknown as ExecutionSessionItemRow[];

      return rows.map(toExecutionSessionItemRecord);
    },
    linkSessionScenarioResult(sessionId, scenarioKey, result) {
      const now = result.createdAt;

      runTransaction(database, () => {
        const existing = database
          .prepare(`
            SELECT session_id
            FROM execution_session_items
            WHERE session_id = ? AND scenario_key = ?
            LIMIT 1
          `)
          .get(sessionId, scenarioKey) as { session_id?: unknown } | undefined;

        if (!existing) {
          throw new Error(
            `Execution session item not found: ${sessionId}/${scenarioKey}`
          );
        }

        database
          .prepare(`
            UPDATE execution_session_items
            SET latest_run_result_id = ?, resolved_status = ?, resolved_at = ?
            WHERE session_id = ? AND scenario_key = ?
          `)
          .run(result.id, result.status, now, sessionId, scenarioKey);

        const unresolvedCount = Number(
          (
            database
              .prepare(`
                SELECT COUNT(*) AS unresolved_count
                FROM execution_session_items
                WHERE session_id = ? AND resolved_status IS NULL
              `)
              .get(sessionId) as { unresolved_count?: unknown } | undefined
          )?.unresolved_count ?? 0
        );

        database
          .prepare(`
            UPDATE execution_sessions
            SET
              status = CASE WHEN ? = 0 THEN 'completed' ELSE 'active' END,
              completed_at = CASE WHEN ? = 0 THEN COALESCE(completed_at, ?) ELSE NULL END
            WHERE id = ?
          `)
          .run(unresolvedCount, unresolvedCount, now, sessionId);
      });
    },
    getSharedSyncState(projectId) {
      const row = database
        .prepare("SELECT * FROM shared_sync_state WHERE project_id = ? LIMIT 1")
        .get(projectId) as unknown as SharedSyncStateRow | undefined;
      return row ? toSharedSyncStateRecord(row) : null;
    },
    upsertSharedSyncState(input) {
      database
        .prepare(`
          INSERT INTO shared_sync_state (
            project_id, last_sync_at, last_sync_error, last_attempt_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id) DO UPDATE SET
            last_sync_at = excluded.last_sync_at,
            last_sync_error = excluded.last_sync_error,
            last_attempt_at = excluded.last_attempt_at
        `)
        .run(
          input.projectId,
          input.lastSyncAt,
          input.lastSyncError,
          input.lastAttemptAt
        );

      const record = this.getSharedSyncState(input.projectId);
      if (!record) {
        throw new Error(`Failed to load shared sync state: ${input.projectId}`);
      }

      return record;
    }
  };
}

function saveFeatureSnapshot(
  database: DatabaseSync,
  upsertFeature: StatementSync,
  upsertScenario: StatementSync,
  feature: FeatureSpec,
  issueCount: number,
  parseHealth: string,
  now: string
): void {
  upsertFeature.run({
    feature_key: feature.relativePath,
    spec_relative_path: feature.relativePath,
    feature_title: feature.title,
    display_title: feature.metadata.title ?? feature.title,
    description: feature.description,
    metadata_json: JSON.stringify(feature.metadata),
    background_json: JSON.stringify(feature.background),
    source_line: feature.location?.line ?? null,
    parse_health: parseHealth,
    issue_count: issueCount,
    synced_at: now
  });

  database
    .prepare(
      "UPDATE scenarios SET is_active = 0, synced_at = ? WHERE feature_key = ?"
    )
    .run(now, feature.relativePath);

  const cases = expandFeatureCases(feature);
  const scenarioIndexMap = new Map<string, ScenarioCaseSpec[]>();

  for (const scenario of feature.scenarios) {
    scenarioIndexMap.set(
      scenario.id,
      cases.filter(
        (scenarioCase) =>
          scenarioCase.scenarioId === scenario.id ||
          scenarioCase.id === scenario.id
      )
    );
  }

  let sortOrder = 0;

  for (const scenario of feature.scenarios) {
    const groupCases = scenarioIndexMap.get(scenario.id) ?? [];
    if (scenario.kind === "scenario") {
      const scenarioCase = groupCases[0];
      if (!scenarioCase) {
        continue;
      }

      sortOrder += 1;
      upsertScenario.run(
        buildScenarioInsertRecord(
          feature.relativePath,
          scenario,
          scenarioCase,
          sortOrder
        )
      );
      continue;
    }

    for (const scenarioCase of groupCases) {
      sortOrder += 1;
      upsertScenario.run(
        buildScenarioInsertRecord(
          feature.relativePath,
          scenario,
          scenarioCase,
          sortOrder
        )
      );
    }
  }
}

function buildScenarioInsertRecord(
  featureKey: string,
  scenario: FeatureSpec["scenarios"][number],
  scenarioCase: ScenarioCaseSpec,
  sortOrder: number
): Record<string, SQLInputValue> {
  return {
    scenario_key: scenarioCase.id,
    feature_key: featureKey,
    group_key: scenario.id,
    group_title: scenario.title,
    title: scenarioCase.title,
    description: scenarioCase.description,
    kind: scenarioCase.kind,
    group_kind: scenario.kind,
    outline_title: scenarioCase.outlineTitle ?? null,
    example_name: scenarioCase.exampleName ?? null,
    example_index: scenarioCase.exampleIndex ?? null,
    example_values_json: scenarioCase.exampleValues
      ? JSON.stringify(scenarioCase.exampleValues)
      : null,
    steps_json: JSON.stringify(scenarioCase.steps),
    tags_json: JSON.stringify(scenarioCase.tags),
    source_line: scenarioCase.location?.line ?? null,
    sort_order: sortOrder,
    synced_at: new Date().toISOString()
  };
}

function getDisplayTitle(parsedFile: ParsedSpecFile): string {
  if (parsedFile.feature) {
    return parsedFile.feature.metadata.title ?? parsedFile.feature.title;
  }

  const baseName = path.basename(parsedFile.relativePath, ".feature");
  return baseName
    .split(/[-_]/g)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getAttachmentsForResultIds(
  database: DatabaseSync,
  resultIds: string[]
): Map<string, EvidenceRef[]> {
  const attachmentMap = new Map<string, EvidenceRef[]>();
  if (resultIds.length === 0) {
    return attachmentMap;
  }

  const rows = database
    .prepare(
      `SELECT run_result_id, kind, value, label
       FROM attachments
       WHERE run_result_id IN (${resultIds.map(() => "?").join(", ")})
       ORDER BY created_at ASC`
    )
    .all(...resultIds) as unknown as AttachmentRow[];

  for (const row of rows) {
    const runResultId = String(row.run_result_id);
    const current = attachmentMap.get(runResultId) ?? [];
    current.push({
      kind: String(row.kind) as EvidenceRef["kind"],
      value: String(row.value),
      label: row.label ? String(row.label) : undefined
    });
    attachmentMap.set(runResultId, current);
  }

  return attachmentMap;
}

function toLatestResultRecord(
  row: LatestResultRow,
  attachments: EvidenceRef[]
): LatestScenarioResult {
  return {
    id: String(row.result_id),
    runId: String(row.run_id),
    scenarioId: String(row.scenario_key ?? ""),
    status: String(row.status) as RunStatus,
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    attachments,
    testerName: String(row.tester_name),
    environment: row.environment ? String(row.environment) : undefined
  };
}

function ensureRunsEnvironmentColumn(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(runs)").all() as Array<{
    name?: unknown;
  }>;

  if (!columns.some((column) => String(column.name) === "environment")) {
    database.exec("ALTER TABLE runs ADD COLUMN environment TEXT;");
  }

  database.exec(`
    UPDATE runs
    SET environment = CASE
      WHEN platform IS NOT NULL AND browser IS NOT NULL THEN platform || '-' || browser
      ELSE COALESCE(platform, browser)
    END
    WHERE environment IS NULL
  `);
}

function toSpecFileRecord(row: SpecFileRow): SpecFileRecord {
  return {
    relativePath: String(row.relative_path),
    absolutePath: String(row.absolute_path),
    contentHash: String(row.content_hash),
    parseHealth: String(row.parse_health),
    issueCount: Number(row.issue_count),
    issuesJson: String(row.issues_json),
    displayTitle: String(row.display_title),
    scannedAt: String(row.scanned_at),
    isActive: Number(row.is_active) === 1
  };
}

function toFeatureRecord(row: FeatureRow): FeatureRecord {
  return {
    featureKey: String(row.feature_key),
    specRelativePath: String(row.spec_relative_path),
    featureTitle: String(row.feature_title),
    displayTitle: String(row.display_title),
    description: String(row.description),
    metadataJson: String(row.metadata_json),
    backgroundJson: String(row.background_json),
    sourceLine: row.source_line === null ? null : Number(row.source_line),
    parseHealth: String(row.parse_health),
    issueCount: Number(row.issue_count),
    isActive: Number(row.is_active) === 1,
    syncedAt: String(row.synced_at)
  };
}

function toScenarioRecord(row: ScenarioRow): ScenarioRecord {
  return {
    scenarioKey: String(row.scenario_key),
    featureKey: String(row.feature_key),
    groupKey: String(row.group_key),
    groupTitle: String(row.group_title),
    title: String(row.title),
    description: String(row.description),
    kind: String(row.kind) as ScenarioRecord["kind"],
    groupKind: String(row.group_kind) as ScenarioRecord["groupKind"],
    outlineTitle: row.outline_title ? String(row.outline_title) : null,
    exampleName: row.example_name ? String(row.example_name) : null,
    exampleIndex: row.example_index === null ? null : Number(row.example_index),
    exampleValuesJson: row.example_values_json
      ? String(row.example_values_json)
      : null,
    stepsJson: String(row.steps_json),
    tagsJson: String(row.tags_json),
    sourceLine: row.source_line === null ? null : Number(row.source_line),
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
    syncedAt: String(row.synced_at)
  };
}

function toExecutionSessionRecord(
  row: ExecutionSessionRow
): ExecutionSessionRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    status: String(row.status) as ExecutionSessionRecord["status"],
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    filtersJson: String(row.filters_json),
    totalCount: Number(row.total_count)
  };
}

function toExecutionSessionSummaryRecord(row: ExecutionSessionSummaryRow) {
  return {
    ...toExecutionSessionRecord(row),
    resolvedCount: Number(row.resolved_count ?? 0),
    nextScenarioKey: row.next_scenario_key
      ? String(row.next_scenario_key)
      : null
  };
}

function toExecutionSessionItemRecord(
  row: ExecutionSessionItemRow
): ExecutionSessionItemRecord {
  return {
    sessionId: String(row.session_id),
    scenarioKey: String(row.scenario_key),
    featureKey: String(row.feature_key),
    featureTitle: String(row.feature_title),
    scenarioTitle: String(row.scenario_title),
    sourceLine: row.source_line === null ? null : Number(row.source_line),
    exampleIndex: row.example_index === null ? null : Number(row.example_index),
    sortOrder: Number(row.sort_order),
    latestRunResultId: row.latest_run_result_id
      ? String(row.latest_run_result_id)
      : null,
    resolvedStatus: row.resolved_status
      ? (String(row.resolved_status) as RunStatus)
      : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    isScenarioActive: Number(row.scenario_active) === 1
  };
}

function toSharedSyncStateRecord(
  row: SharedSyncStateRow
): SharedSyncStateRecord {
  return {
    projectId: String(row.project_id),
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    lastSyncError: row.last_sync_error ? String(row.last_sync_error) : null,
    lastAttemptAt: row.last_attempt_at ? String(row.last_attempt_at) : null
  };
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type StoredStepSpec = StepSpec;

function runTransaction<T>(database: DatabaseSync, callback: () => T): T {
  database.exec("BEGIN");

  try {
    const result = callback();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
