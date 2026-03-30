# GitHub Actions

## Required secrets

- `NPM_TOKEN`
  npm publish permission for the `@spexor/*` packages.

## Publish trigger

- Push a tag like `v0.1.0` to run `publish-npm.yml`.
- `workflow_dispatch` is also enabled for manual releases.

## Publish behavior

- Installs with `pnpm`
- Syncs the root and workspace package versions from the pushed Git tag with `pnpm release:version --from-tag`
- Runs typecheck, tests, and build
- Publishes all public workspace packages with `pnpm -r publish`
- Does not create a release commit in CI; the tag is the source of truth for the published version
