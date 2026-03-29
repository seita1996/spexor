# ADR 0003: Low-Cost Shared Results Hub

- Status: Accepted
- Date: 2026-03-30

## Context

Spexor is intentionally local-first. `.feature` files in Git are the source of truth, and local SQLite is only a query cache plus manual execution history. Small teams still need a way to share execution results and evidence references across members, but the project does not want to turn Spexor itself into a centralized SaaS or force an always-on heavyweight backend.

The shared layer therefore needs to satisfy four constraints:

1. Spexor remains useful offline and without the shared service.
2. Shared state is exported and queried through a stable contract rather than by sharing SQLite files.
3. Hosting cost and operational burden stay low enough for small teams.
4. Evidence can be aggregated as shareable references without pushing binary lifecycle management into Spexor core.

## Decision

Adopt a separate shared results hub with the following boundaries:

1. Spexor exports local run history as NDJSON events.
2. The shared hub ingests those NDJSON events over HTTP and stores them in a server-side index.
3. Spexor reads shared scenario history from the hub through a query API and presents it alongside local history.
4. Spexor core does not own synchronization policy, conflict resolution, or centralized workflow rules.

The canonical shared contract is append-oriented run-result events, not a replicated SQLite database.

## Deployment shape

The shared hub is designed for low-cost serverless and edge hosting.

- Preferred first implementation: Cloudflare Workers for the API, D1 for the query index, and R2 when teams later want object-backed evidence uploads.
- Compatible alternative: AWS Lambda for the API, S3 for exported NDJSON and evidence objects, plus a lightweight SQLite-derived index or equivalent managed low-cost store behind the same HTTP contract.

The API contract stays portable so teams can swap hosting providers without changing Spexor's local data model.

## Consequences

- Spexor stays local-first and can degrade cleanly when the shared hub is unavailable.
- Small teams can host the shared layer with minimal fixed cost.
- Shared history is merged at the API/query layer instead of at the SQLite file layer.
- Evidence aggregation requires shareable URLs or future object-storage upload flows; local filesystem paths alone are not sufficient for team-wide viewing.
