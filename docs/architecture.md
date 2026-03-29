# Architecture

Spexor uses a TypeScript `pnpm` workspace with explicit package boundaries:

- `packages/config`: loads `spexor.config.ts`, applies defaults, resolves paths
- `packages/domain`: pure types and helpers
- `packages/parser`: scans `.feature` files, parses YAML frontmatter and Gherkin, returns structured issues
- `packages/db`: initializes SQLite, stores parsed snapshots and execution history
- `packages/app`: orchestrates config, parser, DB, and watcher behavior into DTOs for the UI
- `packages/results`: shared run-result event schema, NDJSON helpers, and hub client helpers
- `packages/ui`: shared presentational React components
- `apps/web`: local Node API plus Vite/React UI
- `apps/results-hub`: low-cost shared results API for NDJSON ingest and scenario history queries

## Runtime shape

- The web app is split into a small Node API and a React client.
- The Node API owns filesystem access, config loading, auto-scan, and SQLite writes.
- The React client only talks to JSON endpoints under `/api`.
- The optional shared hub is a separate HTTP service. Spexor reads from it but does not depend on it for local execution.

## Source of truth

- `.feature` files in Git are authoritative.
- Frontmatter supplies file-level metadata.
- SQLite stores queryable snapshots and run history only.
- Shared team history lives outside Spexor's local SQLite and is exchanged as NDJSON run-result events.

## Data flow

1. App startup loads `spexor.config.ts`.
2. The app creates `.spexor/` paths as needed and initializes SQLite.
3. The parser scans `specDir` and parses each `.feature` file.
4. Parsed feature snapshots are upserted into SQLite.
5. The UI fetches list/detail/history DTOs from the local API.
6. Saving a manual run inserts a `run`, a `run_result`, and any evidence references.
7. When configured, Spexor can export runs as NDJSON for the shared hub and query shared history back over HTTP.

## Scenario identity

- Feature ID: repo-relative file path
- Scenario ID: `file path + normalized title + occurrence index`
- Outline example case ID: scenario ID plus example index

This keeps the MVP explicit. Renaming a scenario creates a new current ID; old local history remains in SQLite.
