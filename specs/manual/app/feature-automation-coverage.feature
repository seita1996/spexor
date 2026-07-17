---
id: spexor.automation-coverage
title: Automated coverage display
domain: catalog
lifecycle: active
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
      file: apps/spexor/src/pages/SpecWorkspacePage.test.tsx
      tests:
        - "SpecWorkspacePage > shows a searchable spec explorer and selected scenario workspace"
        - "SpecWorkspacePage > records a manual result for the selected scenario"
    - runner: playwright
      file: packages/e2e-test/tests/core-flow.spec.ts
      tests:
        - "Spexor core flow > shows automated coverage for a linked feature"
---

Feature: Spexor automated coverage display

  @spexor-id:spexor.automation-coverage.inspect
  Scenario: Inspect linked automated checks from a feature
    Given a feature links Vitest and Playwright coverage in frontmatter
    When I open the feature detail page
    Then I should see structured automated coverage grouped by runner and file

  @spexor-id:spexor.automation-coverage.manual
  Scenario: Preserve manual execution alongside automated links
    Given a feature is linked to automated tests
    When I review its detail page
    Then I should still be able to start a feature session and open scenario history
