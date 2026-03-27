# ADR 0001: Codex Harness Baseline

- Status: Accepted
- Date: 2026-03-28

## Context

Spexor is a TypeScript workspace that is being developed with Codex as the primary coding agent. Codex does not currently provide Claude Code style per-tool hooks, so quality must be enforced through repository-level guardrails that are cheap to run, hard to ignore, and easy for an agent to discover.

The repository already has tests and explicit package boundaries, but it lacks four things that make agent-driven iteration safer:

1. A short AGENTS pointer file with authoritative commands.
2. A deterministic formatter and linter.
3. A standardized session startup routine.
4. A structured progress file that survives session boundaries.

## Decision

Adopt the following baseline harness for Codex-centered work:

1. Keep the root `AGENTS.md` short and pointer-oriented.
2. Use Biome as the default formatter and Oxlint as the default linter for the workspace.
3. Enforce a fast local gate with `pnpm guard:fast` and a fuller gate with `pnpm guard`.
4. Install a Lefthook-managed Git pre-commit hook for repository harness checks and staged turn checks.
5. Add `pnpm agent:start` as the standard session bootstrap command.
6. Track near-term task priority in `ops/agent-tasks.json`.
7. Preserve future architectural decisions as new ADRs under `docs/adr/`.

## Consequences

- Codex sessions can discover the expected commands without reading long prose.
- Formatting and baseline static checks become deterministic instead of model-dependent.
- Codex-specific turn-boundary automation can be layered on top without rewriting the baseline.
- Commits are less likely to carry obvious regressions.
- The task queue becomes machine-readable, but it must stay small and be revised when priorities change.
- README and architecture docs remain secondary to code, tests, config, and ADRs.
