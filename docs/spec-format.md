# Spec format

Spexor reads manual specs from `.feature` files.

## Frontmatter

Optional YAML frontmatter may appear at the top of the file:

```yaml
---
title: Login
environments:
  - mac-chrome
  - mac-safari
tags:
  - auth
priority: high
owner: qa@example.com
related:
  - https://github.com/example/repo/issues/123
---
```

Supported MVP fields:

- `title: string`
- `environments: string[]`
- `tags: string[]`
- `priority: low | medium | high`
- `owner: string`
- `related: string[]`

Unknown fields are preserved in metadata but are not first-class UI fields in the MVP.

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
- The UI shows parse health and issue details for affected files.
