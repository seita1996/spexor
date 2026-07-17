# ADR 0007: Run lifecycle, review, and reporting

- Status: accepted
- Date: 2026-07-17

## Context

The initial execution-session model allowed results to be recorded but did not define a product-level Run lifecycle. A completed record could display a newer unrelated Scenario result, clients used session-centric endpoints, and no common report model existed for UI review and CI export.

## Decision

`Run` is the product and API term. `/api/runs` is canonical; `/api/sessions` remains only as a temporary internal alias while callers migrate. The TypeScript names can be replaced separately without changing persisted semantics.

A Run is mutable only while active. Resolving its final Scenario completes it, after which both application and database boundaries reject further result links. Each Run item reads the exact linked result ID, never the latest result for that Scenario.

Retry creates a new Run from only failed and blocked Scenario IDs and records `baseRunId`. It captures current source snapshots and Git context instead of mutating or reopening the completed Run. SQLite schema version 4 rebuilds older local projections because backward compatibility is not a product constraint.

`packages/reporting` owns one versioned, transport-independent report model and deterministic Markdown, JSON, and JUnit formatters. The app constructs that model from immutable Run snapshots. The Review UI, HTTP downloads, and `spexor export run` CLI all consume the same model.

## Consequences

- Completed Runs remain stable even when later independent results are recorded.
- Retry lineage is explicit and historical source Runs remain untouched.
- Review and CI exports cannot drift into format-specific data queries.
- JUnit treats failed as failure and blocked, skipped, or not-run as skipped.
- Opening a pre-v4 database intentionally rebuilds local SQLite history.
