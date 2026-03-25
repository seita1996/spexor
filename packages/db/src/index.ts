import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  expandFeatureCases,
  normalizePath,
  type EvidenceRef,
  type FeatureSpec,
  type LatestScenarioResult,
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

export interface RecordScenarioRunInput {
  scenarioKey: string;
  featureKey: string;
  testerName: string;
  browser?: string | undefined;
  platform?: string | undefined;
  status: RunStatus;
  notes?: string | undefined;
  attachments: EvidenceRef[];
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
  getScenarioRunHistory(scenarioKey: string, limit?: number): ScenarioHistoryEntry[];
  recordScenarioRun(input: RecordScenarioRunInput): ScenarioHistoryEntry;
}

type RawRow = Record<string, unknown>;

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

  CREATE INDEX IF NOT EXISTS idx_spec_files_active ON spec_files(is_active);
  CREATE INDEX IF NOT EXISTS idx_features_active ON features(is_active);
  CREATE INDEX IF NOT EXISTS idx_scenarios_feature_active ON scenarios(feature_key, is_active, sort_order);
  CREATE INDEX IF NOT EXISTS idx_run_results_scenario_created ON run_results(scenario_key, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_attachments_run_result ON attachments(run_result_id);
`;

export function initDatabase(dbPath: string): SpexorDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(schema);

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
    const activeFlag = relativePaths.length === 0 ? "" : `WHERE relative_path NOT IN (${relativePaths.map(() => "?").join(", ")})`;
    database.prepare(`UPDATE spec_files SET is_active = 0 ${activeFlag}`).run(...relativePaths);
    const featureFlag = relativePaths.length === 0 ? "" : `WHERE feature_key NOT IN (${relativePaths.map(() => "?").join(", ")})`;
    database.prepare(`UPDATE features SET is_active = 0 ${featureFlag}`).run(...relativePaths);
    database.prepare(`UPDATE scenarios SET is_active = 0 ${featureFlag}`).run(...relativePaths);
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
            .prepare("UPDATE features SET is_active = 0, synced_at = ? WHERE feature_key = ?")
            .run(now, parsedFile.relativePath);
          database
            .prepare("UPDATE scenarios SET is_active = 0, synced_at = ? WHERE feature_key = ?")
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

  const getScenarioRunHistory = (scenarioKey: string, limit = 20): ScenarioHistoryEntry[] => {
    const rows = database
      .prepare(`
        SELECT
          rr.id AS result_id,
          rr.run_id,
          rr.scenario_key,
          rr.status,
          rr.notes,
          rr.created_at,
          runs.tester_name,
          runs.browser,
          runs.platform
        FROM run_results rr
        INNER JOIN runs ON runs.id = rr.run_id
        WHERE rr.scenario_key = ?
        ORDER BY rr.created_at DESC
        LIMIT ?
      `)
      .all(scenarioKey, limit) as RawRow[];

    const attachmentMap = getAttachmentsForResultIds(
      database,
      rows.map((row) => String(row.result_id))
    );

    return rows.map((row) => ({
      scenarioKey,
      ...toLatestResultRecord(row, attachmentMap.get(String(row.result_id)) ?? [])
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
        .prepare("SELECT * FROM spec_files WHERE is_active = 1 ORDER BY relative_path")
        .all() as RawRow[];
      return rows.map(toSpecFileRecord);
    },
    getSpecFile(relativePath) {
      const row = database
        .prepare("SELECT * FROM spec_files WHERE relative_path = ? LIMIT 1")
        .get(relativePath) as RawRow | undefined;
      return row ? toSpecFileRecord(row) : null;
    },
    getFeature(relativePath) {
      const row = database
        .prepare("SELECT * FROM features WHERE feature_key = ? AND is_active = 1 LIMIT 1")
        .get(relativePath) as RawRow | undefined;
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
        .all() as RawRow[];

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
        .all(relativePath) as RawRow[];
      return rows.map(toScenarioRecord);
    },
    getScenario(scenarioKey) {
      const row = database
        .prepare("SELECT * FROM scenarios WHERE scenario_key = ? LIMIT 1")
        .get(scenarioKey) as RawRow | undefined;
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
        .all(relativePath) as RawRow[];

      const attachmentMap = getAttachmentsForResultIds(
        database,
        rows.map((row) => String(row.result_id))
      );

      return rows.map((row) => ({
        scenarioKey: String(row.scenario_key),
        ...toLatestResultRecord(row, attachmentMap.get(String(row.result_id)) ?? [])
      }));
    },
    getScenarioRunHistory,
    recordScenarioRun(input) {
      const now = new Date().toISOString();
      const runId = crypto.randomUUID();
      const resultId = crypto.randomUUID();

      runTransaction(database, () => {
        database
          .prepare(`
            INSERT INTO runs (id, scenario_key, feature_key, tester_name, browser, platform, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            runId,
            input.scenarioKey,
            input.featureKey,
            input.testerName,
            input.browser ?? null,
            input.platform ?? null,
            now
          );

        database
          .prepare(`
            INSERT INTO run_results (id, run_id, scenario_key, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          .run(resultId, runId, input.scenarioKey, input.status, input.notes ?? "", now);

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

      return getScenarioRunHistory(input.scenarioKey, 1)[0]!;
    }
  };
}

function saveFeatureSnapshot(
  database: any,
  upsertFeature: any,
  upsertScenario: any,
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
    .prepare("UPDATE scenarios SET is_active = 0, synced_at = ? WHERE feature_key = ?")
    .run(now, feature.relativePath);

  const cases = expandFeatureCases(feature);
  const scenarioIndexMap = new Map<string, ScenarioCaseSpec[]>();

  for (const scenario of feature.scenarios) {
    scenarioIndexMap.set(
      scenario.id,
      cases.filter((scenarioCase) => scenarioCase.scenarioId === scenario.id || scenarioCase.id === scenario.id)
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
      upsertScenario.run(buildScenarioInsertRecord(feature.relativePath, scenario, scenarioCase, sortOrder));
      continue;
    }

    for (const scenarioCase of groupCases) {
      sortOrder += 1;
      upsertScenario.run(buildScenarioInsertRecord(feature.relativePath, scenario, scenarioCase, sortOrder));
    }
  }
}

function buildScenarioInsertRecord(
  featureKey: string,
  scenario: FeatureSpec["scenarios"][number],
  scenarioCase: ScenarioCaseSpec,
  sortOrder: number
): Record<string, unknown> {
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
    example_values_json: scenarioCase.exampleValues ? JSON.stringify(scenarioCase.exampleValues) : null,
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
  database: any,
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
    .all(...resultIds) as RawRow[];

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

function toLatestResultRecord(row: RawRow, attachments: EvidenceRef[]): LatestScenarioResult {
  return {
    id: String(row.result_id),
    runId: String(row.run_id),
    scenarioId: String(row.scenario_key ?? ""),
    status: String(row.status) as RunStatus,
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at),
    attachments,
    testerName: String(row.tester_name),
    browser: row.browser ? String(row.browser) : undefined,
    platform: row.platform ? String(row.platform) : undefined
  };
}

function toSpecFileRecord(row: RawRow): SpecFileRecord {
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

function toFeatureRecord(row: RawRow): FeatureRecord {
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

function toScenarioRecord(row: RawRow): ScenarioRecord {
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
    exampleValuesJson: row.example_values_json ? String(row.example_values_json) : null,
    stepsJson: String(row.steps_json),
    tagsJson: String(row.tags_json),
    sourceLine: row.source_line === null ? null : Number(row.source_line),
    sortOrder: Number(row.sort_order),
    isActive: Number(row.is_active) === 1,
    syncedAt: String(row.synced_at)
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
