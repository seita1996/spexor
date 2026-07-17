# ADR 0006: Commit-aware verification runs

- Status: accepted
- Date: 2026-07-17

## Context

Manual results previously recorded who, when, and status, but not the Git state being verified. Run items also read steps from the current `scenarios` row, so editing or deleting a `.feature` file could change or erase the content shown for an earlier run.

## Decision

Run creation captures Git context through a dedicated `packages/git` boundary. It invokes the installed Git CLI without a shell and records repository root, branch when attached, commit SHA, dirty state, and capture time. A missing Git executable, a non-Git directory, or an unborn repository degrades to an unavailable or partial context instead of preventing the run.

Every executable scenario case receives a canonical SHA-256 fingerprint. The canonical payload includes logical Feature and Scenario IDs, rendered title and description, ordered background and scenario steps, Example values, tags, and environments. Object keys and set-like arrays are normalized before hashing; step order remains significant.

At run creation, each item stores immutable Feature title, Scenario title, rendered steps, environments, and fingerprint. Reads compare the stored fingerprint with the active Scenario fingerprint. A mismatch or missing active Scenario marks the item stale, while the saved snapshot remains readable.

SQLite schema version 3 uses these fields directly rather than introducing compatibility aliases. Opening a pre-v3 database rebuilds the local projection.

## Consequences

- A run identifies the code state and worktree condition it verified.
- Title, step, metadata, and Example changes are visible as stale history.
- Deleted specifications do not erase historical Run content.
- Git is optional at runtime and adds no library dependency.
- Pre-v3 local history is intentionally discarded during the schema rebuild.
