CREATE TABLE IF NOT EXISTS shared_run_events (
  event_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  scenario_key TEXT NOT NULL,
  scenario_title TEXT NOT NULL,
  run_id TEXT NOT NULL,
  tester_name TEXT NOT NULL,
  environment TEXT,
  status TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attachments_json TEXT NOT NULL,
  source_json TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_run_events_project_scenario_created
  ON shared_run_events(project_id, scenario_key, created_at DESC);
