# Spexor

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
pnpm dev
```

Then open the local Vite URL shown in the terminal. The default `spexor.config.ts` points at the bundled demo specs under `examples/demo-project/specs/manual`.

## Use from another project

Install Spexor into the project you want to manage:

```bash
npm install -D @spexor/web
```

Then run:

```bash
npx spexor dev
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

## Docs

- [Architecture](/Users/tahara/Documents/prj/spexor/docs/architecture.md)
- [Spec format](/Users/tahara/Documents/prj/spexor/docs/spec-format.md)
- [Local data model](/Users/tahara/Documents/prj/spexor/docs/local-data-model.md)
