# Local data model

SQLite stores local execution history and cached parsed snapshots.

## Tables

- `spec_files`
  Stores repo-relative path, content hash, parse health, issue JSON, display title, and scan timestamps.

- `features`
  Stores the active parsed feature snapshot keyed by stable Feature ID, including its source path, identity source, metadata, and background JSON.

- `scenarios`
  Stores active executable scenario cases keyed by stable Scenario ID (or an Outline case suffix) and records whether the ID is explicit or legacy.
  Each row includes a canonical SHA-256 specification fingerprint.
  Regular scenarios map 1:1.
  Scenario Outline rows are expanded into concrete runnable cases.

- `runs`
  Stores a manual execution session.
  In the MVP, one save action creates one run.

- `run_results`
  Stores per-scenario execution results: status, notes, timestamp, and run linkage.

- `attachments`
  Stores evidence references only: file path or URL plus an optional label.

- `execution_sessions`
  Stores verification Run metadata, filters, progress, and the Git context captured at creation.

- `execution_session_items`
  Stores immutable Feature title, Scenario title, rendered steps, environments, and specification fingerprint for every Run item.

## Activity flags

Feature and scenario snapshot rows use `is_active` flags so rescans can deactivate old records without deleting historical runs.

## Schema version

SQLite `user_version` 3 introduces commit-aware Runs and immutable Scenario snapshots. Opening a pre-v3 database rebuilds the local database. This is intentional: backward compatibility is not maintained for the disposable local projection, while `.feature` files remain authoritative.

## Persistence boundaries

- Spec content never writes back from the UI into `.feature` files.
- Evidence binaries are not copied into the database.
- SQLite is local query state, not collaborative state.
