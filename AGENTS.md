# AGENTS.md

Spexor uses a Codex-first harness: prefer executable checks over descriptive docs.

- Start every session with `pnpm agent:start`.
- The task queue lives in `ops/agent-tasks.json`; update it only when priorities change.
- Architectural decisions live in `docs/adr/`. Add a new ADR instead of rewriting old ones.
- Core architecture pointers are in `docs/architecture.md`, but code, tests, and ADRs win on conflicts.
- Codex turn-boundary automation is configured in `.codex/config.toml`.
- Turn-complete cleanup: `pnpm codex:turn-check`
- Harness invariant check: `pnpm harness:check`
- Fast quality gate: `pnpm guard:fast` (`oxlint` + `tsc`)
- Full quality gate: `pnpm guard`
- Release gate: `pnpm release:check`
- UI work is not done until the relevant test passes and the page is sanity-checked in the browser.

Do:

- Keep changes scoped to one feature or one fix at a time.
- Add or update tests for behavioral changes.
- Run `pnpm format` after structural edits that touch multiple files.
- Keep `lefthook.yml` aligned with the root guard commands.
- Use existing workspace boundaries: `packages/*` for reusable logic, `apps/web` for delivery.

Do not:

- Edit generated outputs or `dist/`.
- Replace ADR history; supersede it with a new ADR.
- Add descriptive docs that duplicate package manifests, tests, or config files.
- Declare work complete before `pnpm guard` passes for the touched area.
