---
title: Execution session flow
environments:
  - mac-chrome
tags:
  - spexor
  - session
priority: high
owner: qa@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: apps/spexor/src/pages/ExecutionSessionPage.test.tsx
      tests:
        - "ExecutionSessionPage > loads a session and updates progress after saving a result"
        - "ExecutionSessionPage > shows a completion dialog and feature return link when the last test is saved"
    - runner: playwright
      file: packages/e2e-test/tests/core-flow.spec.ts
      tests:
        - "Spexor core flow > completes a manual-only feature session and returns to the feature"
---

Feature: Spexor execution session

  Scenario: Resolve a feature session end-to-end
    Given I start a feature session from a feature detail page
    When I record results for all remaining scenario cases
    Then I should see the session marked complete

  Scenario: Return to the feature after completion
    Given all session test cases are resolved
    When the completion dialog appears
    Then I should be able to navigate back to the source feature
