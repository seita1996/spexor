# Spexor

[![CI](https://github.com/seita1996/spexor/actions/workflows/ci.yml/badge.svg)](https://github.com/seita1996/spexor/actions/workflows/ci.yml)
[![CodeQL](https://github.com/seita1996/spexor/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/seita1996/spexor/actions/workflows/github-code-scanning/codeql)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/%40spexor%2Fspexor)](https://www.npmjs.com/package/@spexor/spexor)
![NPM Downloads](https://img.shields.io/npm/dy/%40spexor%2Fspexor)

Spexor is a Git-native manual spec runner for Gherkin-based workflows.

It keeps manual test specifications close to source code as `.feature` files, lets a developer or QA engineer execute those specs in a local GUI, and stores execution history in SQLite without turning the spec source of truth into a database.

## What Spexor is

- A local-first manual execution tool for Gherkin specs
- A Git-managed workflow where `.feature` files stay in the repo
- A base layer for future living documentation across manual and automated specs
- An OSS-friendly MVP with explicit packages and boring architecture

## What Spexor is not

- Not a centralized SaaS
- Not an enterprise test management replacement
- Not a bug tracker, approval workflow, or spreadsheet clone
- Not a sync layer for Jira, GitHub Issues, or test plans
- Not an automated Playwright or Vitest runner

## Why specs live in Git

Manual specs are product documentation and execution guidance. Keeping them as text files inside the repo means they can be reviewed, versioned, branched, and diffed with the code they describe.

## Why SQLite is local-only

SQLite is used for execution history and cached spec snapshots so the UI can query recent runs quickly. It is not the source of truth for specifications, and Spexor does not write back into `.feature` files.

## Why evidence is referenced instead of stored

The MVP stores evidence as file path or URL references. That keeps Spexor lightweight, avoids silently copying binary artifacts into the repo, and fits local team workflows where screenshots and logs may already live elsewhere.

## Quick start

```bash
pnpm install
pnpm harness:check
pnpm dev
```

Then open the local Vite URL shown in the terminal. The default `spexor.config.ts` points at the bundled demo specs under `examples/demo-project/specs/manual`.

## Use from another project

Install Spexor into the project you want to manage:

```bash
npm install -D @spexor/spexor
```

Then run:

```bash
npx spexor dev
```

Bootstrap a repository with the default config and starter spec:

```bash
npx spexor setup
```

If the target project has no config yet, Spexor defaults to `./specs/manual`, `./.spexor/spexor.db`, and `./.spexor/evidence` relative to that project root.

## Add your own specs

1. Create or update `spexor.config.ts`.
2. Point `specDir` at your manual specs directory.
3. Add `.feature` files with optional YAML frontmatter.
4. Restart the app or use the in-app rescan button.

Example config:

```ts
export default {
  specDir: "./specs/manual",
  dbPath: "./.spexor/spexor.db",
  evidenceDir: "./.spexor/evidence",
  autoScan: true
};
```

## Record manual runs

1. Open a feature from the specs list.
2. Choose a scenario or outline example row.
3. Set the status, tester name, notes, and any evidence references.
4. Save the result.

Execution history persists in `.spexor/spexor.db` across restarts.

## Shared hub deployment

Spexor can scaffold and deploy the low-cost shared results hub from the CLI.

```bash
npx spexor hub deploy cloudflare
npx spexor hub deploy aws
```

The Cloudflare flow scaffolds a Worker + D1 project under `.spexor/results-hub/cloudflare`. The AWS flow scaffolds a CDK app for Lambda + S3 under `.spexor/results-hub/aws`.

## Docs

## Harness

Codex-centered development in this repository uses deterministic harness commands:

- `pnpm harness:check` verifies the repository-level Codex and hook wiring.
- `pnpm codex:turn-check` applies Oxlint fixes and Biome formatting to changed files.
- `pnpm guard:fast` runs harness verification, lint, and typecheck.

- [Architecture](./docs/architecture.md)
- [Agent instructions](./AGENTS.md)
- [ADR 0001: Codex harness baseline](./docs/adr/0001-codex-harness-baseline.md)
- [ADR 0002: Codex turn-boundary guardrails](./docs/adr/0002-codex-turn-boundary-guardrails.md)
- [ADR 0003: Low-cost shared results hub](./docs/adr/0003-low-cost-shared-results-hub.md)
- [ADR 0004: CLI setup and hub deploy](./docs/adr/0004-cli-setup-and-hub-deploy.md)
- [Spec format](./docs/spec-format.md)
- [Local data model](./docs/local-data-model.md)
