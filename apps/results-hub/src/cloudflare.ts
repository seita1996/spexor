import type { EvidenceRef } from "@spexor/domain";
import type { SharedRunEvent, SharedRunSource } from "@spexor/results";
import { createResultsHubHandler, type SharedResultsStore } from "./index";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface Env {
  RESULTS_DB: D1Database;
}

interface SharedRunEventRow {
  event_id: string;
  project_id: string;
  feature_id: string;
  scenario_key: string;
  scenario_title: string;
  run_id: string;
  tester_name: string;
  environment: string | null;
  status: SharedRunEvent["status"];
  notes: string;
  created_at: string;
  attachments_json: string;
  source_json: string;
}

class CloudflareD1SharedResultsStore implements SharedResultsStore {
  constructor(private readonly db: D1Database) {}

  async ingest(projectId: string, events: SharedRunEvent[]): Promise<number> {
    if (events.length === 0) {
      return 0;
    }

    const importedAt = new Date().toISOString();
    const statements = events.map((event) =>
      this.db
        .prepare(
          `INSERT OR REPLACE INTO shared_run_events (
            event_id,
            project_id,
            feature_id,
            scenario_key,
            scenario_title,
            run_id,
            tester_name,
            environment,
            status,
            notes,
            created_at,
            attachments_json,
            source_json,
            imported_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          event.eventId,
          projectId,
          event.featureId,
          event.scenarioKey,
          event.scenarioTitle,
          event.runId,
          event.testerName,
          event.environment ?? null,
          event.status,
          event.notes,
          event.createdAt,
          JSON.stringify(event.attachments),
          JSON.stringify(event.source),
          importedAt
        )
    );

    await this.db.batch(statements);
    return events.length;
  }

  async getScenarioResults(
    projectId: string,
    scenarioKey: string
  ): Promise<SharedRunEvent[]> {
    const result = await this.db
      .prepare(
        `SELECT
          event_id,
          project_id,
          feature_id,
          scenario_key,
          scenario_title,
          run_id,
          tester_name,
          environment,
          status,
          notes,
          created_at,
          attachments_json,
          source_json
        FROM shared_run_events
        WHERE project_id = ? AND scenario_key = ?
        ORDER BY created_at DESC`
      )
      .bind(projectId, scenarioKey)
      .all<SharedRunEventRow>();

    return result.results.map((row) => ({
      version: 1,
      eventId: row.event_id,
      projectId: row.project_id,
      featureId: row.feature_id,
      scenarioKey: row.scenario_key,
      scenarioTitle: row.scenario_title,
      runId: row.run_id,
      testerName: row.tester_name,
      environment: row.environment ?? undefined,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      attachments: JSON.parse(row.attachments_json) as EvidenceRef[],
      source: JSON.parse(row.source_json) as SharedRunSource
    }));
  }
}

export default {
  fetch(request: Request, env: Env) {
    const store = new CloudflareD1SharedResultsStore(env.RESULTS_DB);
    return createResultsHubHandler(store)(request);
  }
};
