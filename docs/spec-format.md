# Spec format

Spexor reads manual specs from `.feature` files.

## Frontmatter

Optional YAML frontmatter may appear at the top of the file:

```yaml
---
id: authentication.login
title: Login
domain: authentication
lifecycle: active
environments:
  - mac-chrome
  - mac-safari
tags:
  - auth
priority: high
owner: qa@example.com
related:
  - https://github.com/example/repo/issues/123
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: apps/spexor/src/pages/SpecWorkspacePage.test.tsx
      tests:
        - "SpecWorkspacePage > uses the workspace for execution session routes"
---
```

Supported MVP fields:

- `id: string` (stable Feature identity)
- `title: string`
- `domain: string`
- `lifecycle: draft | active | deprecated | archived` (defaults to `active`)
- `environments: string[]`
- `tags: string[]`
- `priority: low | medium | high`
- `owner: string`
- `related: string[]`
- `verification.manualOnly: boolean`
- `verification.automated[].runner: vitest | playwright`
- `verification.automated[].file: string`
- `verification.automated[].tests: string[]`

If `verification` is omitted, Spexor treats the feature as `manualOnly: true` with no automated links.
Unknown fields are preserved in metadata but are not first-class UI fields in the MVP.

## Stable identities

Feature IDs use frontmatter `id`. Scenario and Scenario Outline IDs use the reserved `@spexor-id:` tag:

```gherkin
@spexor-id:authentication.login.valid-credentials
Scenario: Login with valid credentials
  Given a registered user exists
  When valid credentials are submitted
  Then the dashboard is displayed
```

IDs must match:

```regex
^[a-z0-9][a-z0-9._-]{2,127}$
```

They must be unique across the project. The reserved tag is not included in ordinary tag filters. Specs without explicit IDs still load with an unstable legacy ID and show a warning. Invalid or duplicate IDs are reported as parse issues.

Scenario Outline example cases currently append `::example-N` to the Scenario ID. Reordering example rows can therefore change case identity.

## Gherkin support

Spexor parses:

- `Feature`
- `Background`
- `Scenario`
- `Scenario Outline`
- `Examples`
- `Given`
- `When`
- `Then`
- `And`
- `But`

The parser preserves titles, descriptions, step text, file path, and source line info when available.

## Parse failure behavior

- Invalid frontmatter produces structured parse issues and falls back safely.
- Invalid Gherkin produces structured parse issues and does not crash the app.
- Invalid or duplicate explicit IDs produce structured identity issues and use a legacy fallback.
- The UI shows parse health and issue details for affected files.
