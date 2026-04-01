---
title: Spec catalog
environments:
  - mac-chrome
tags:
  - spexor
  - catalog
priority: high
owner: product@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: apps/spexor/src/pages/SpecsListPage.test.tsx
      tests:
        - "SpecsListPage > filters loaded specs by tag"
    - runner: playwright
      file: packages/e2e-test/tests/core-flow.spec.ts
      tests:
        - "Spexor core flow > shows automated coverage for a linked feature"
---

Feature: Spexor spec catalog

  Scenario: Browse the self-hosted spec catalog
    Given Spexor indexes its own manual specs from the repository
    When I open the spec list
    Then I should find feature entries for Spexor's own workflows

  Scenario: Filter the catalog before opening a feature
    Given the spec catalog contains features with multiple tags
    When I filter by a specific tag
    Then I should only see matching feature entries
