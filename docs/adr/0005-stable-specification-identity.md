# ADR 0005: Stable specification identity

- Status: accepted
- Date: 2026-07-11

## Context

Spexor previously derived Feature identity from its file path and Scenario identity from the path, an ASCII-only title slug, and occurrence order. Titles written only with non-ASCII characters collapsed to the same fallback slug. Renaming or moving a file, changing a title, or reordering scenarios could therefore disconnect a specification from its execution history.

## Decision

Features may declare a stable logical ID in YAML frontmatter:

```yaml
id: authentication.login
```

Scenarios and Scenario Outlines may declare a stable logical ID with a reserved tag:

```gherkin
@spexor-id:authentication.login.valid-credentials
Scenario: Login with valid credentials
```

IDs must match `^[a-z0-9][a-z0-9._-]{2,127}$` and be unique within the project. Reserved identity tags are metadata and are excluded from ordinary tags.

The logical Feature and Scenario IDs are the SQLite primary keys. File paths remain source locations, not identities. Scenario Outline example cases append `::example-N` to the Scenario ID until explicit Example row identity is designed.

Specs without explicit IDs remain readable through a legacy path/title-derived identity. They are marked unstable in the API, CLI, and UI. Invalid or duplicate explicit IDs produce parse issues and fall back to legacy identity so the catalog remains inspectable.

Spexor does not write IDs back to `.feature` files. Authors add or edit them through their normal Git workflow.

## Migration

This decision intentionally does not preserve pre-identity local execution history. SQLite `user_version` 2 rebuilds older databases on first open. The database is a local projection; `.feature` files remain the source of truth.

## Consequences

- Explicit IDs survive file moves, title changes, and scenario reordering.
- APIs and URLs can use logical IDs without a parallel path-derived key model.
- Existing users must add IDs to gain stable history.
- Reordering Scenario Outline examples can still change case identity and is documented as a current limitation.
