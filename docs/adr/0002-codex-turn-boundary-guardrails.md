# ADR 0002: Codex Turn-Boundary Guardrails

- Status: Accepted
- Date: 2026-03-28

## Context

Codex does not expose Claude Code style `PreToolUse` or `PostToolUse` hooks in this repository environment. The project-scoped hook surface available today is `.codex/config.toml` with `notify`, and the hook fires at `agent-turn-complete`.

That means Spexor cannot enforce deterministic checks after every single file edit. To keep Codex-centered development reliable, the repository needs turn-boundary automation plus a second enforcement layer at commit time.

## Decision

Adopt the following guardrails:

1. Add project-scoped `.codex/config.toml` and register `notify` for `agent-turn-complete`.
2. Route notify events to `.codex/hooks/agent_turn_complete.py`, which runs `pnpm codex:turn-check`.
3. Implement `pnpm codex:turn-check` to apply Oxlint fixes first and then Biome formatting to changed files only.
4. Enforce `pnpm harness:check` and `pnpm codex:turn-check staged` in Lefthook `pre-commit`.
5. Make `pnpm guard:fast` depend on `pnpm harness:check` so local and CI execution use the same harness baseline.

## Consequences

- Codex turns automatically normalize changed files with Oxlint and Biome.
- Commit boundaries re-run the same guardrail against staged files and re-stage the result.
- The approach remains batch-oriented because `notify` only runs after `agent-turn-complete`.
- Partially staged files are rejected by `pnpm codex:turn-check staged` to avoid corrupting the index.
