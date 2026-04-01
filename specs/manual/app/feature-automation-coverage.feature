---
title: Automated coverage display
environments:
  - mac-chrome
tags:
  - spexor
  - coverage
priority: high
owner: product@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: apps/spexor/src/pages/FeatureDetailPage.test.tsx
      tests:
        - "FeatureDetailPage > opens scenario history in a dialog"
        - "FeatureDetailPage > starts an execution session for the full feature"
    - runner: playwright
      file: packages/e2e-test/tests/core-flow.spec.ts
      tests:
        - "Spexor core flow > shows automated coverage for a linked feature"
---

Feature: Spexor automated coverage display

  Scenario: Inspect linked automated checks from a feature
    Given a feature links Vitest and Playwright coverage in frontmatter
    When I open the feature detail page
    Then I should see structured automated coverage grouped by runner and file

  Scenario: Preserve manual execution alongside automated links
    Given a feature is linked to automated tests
    When I review its detail page
    Then I should still be able to start a feature session and open scenario history
