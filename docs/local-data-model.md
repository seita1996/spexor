# Local data model

SQLite stores local execution history and cached parsed snapshots.

## Tables

- `spec_files`
  Stores repo-relative path, content hash, parse health, issue JSON, display title, and scan timestamps.

- `features`
  Stores the active parsed feature snapshot for a file, including metadata and background JSON.

- `scenarios`
  Stores active executable scenario cases.
  Regular scenarios map 1:1.
  Scenario Outline rows are expanded into concrete runnable cases.

- `runs`
  Stores a manual execution session.
  In the MVP, one save action creates one run.

- `run_results`
  Stores per-scenario execution results: status, notes, timestamp, and run linkage.

- `attachments`
  Stores evidence references only: file path or URL plus an optional label.

## Activity flags

Feature and scenario snapshot rows use `is_active` flags so rescans can deactivate old records without deleting historical runs.

## Persistence boundaries

- Spec content never writes back from the UI into `.feature` files.
- Evidence binaries are not copied into the database.
- SQLite is local query state, not collaborative state.
