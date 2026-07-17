---
id: spexor.verification-run-workflow
title: Verification Run workflow
domain: execution
lifecycle: active
environments:
  - mac-chrome
tags:
  - spexor
  - run
  - reporting
priority: high
owner: qa@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: packages/app/src/index.test.ts
      tests:
        - "@spexor/app > syncs specs, returns detail DTOs, and records history"
    - runner: vitest
      file: packages/reporting/src/index.test.ts
      tests:
        - "@spexor/reporting > formats reviewable Markdown"
        - "@spexor/reporting > formats stable JSON"
        - "@spexor/reporting > formats escaped JUnit XML"
    - runner: vitest
      file: apps/spexor/src/pages/RunBuilderPage.test.tsx
      tests:
        - "RunBuilderPage > creates a Run from the selected Scenario snapshot"
    - runner: vitest
      file: apps/spexor/src/pages/RunReviewPage.test.tsx
      tests:
        - "RunReviewPage > filters immutable results and exposes all export formats"
---

Feature: Verification Run workflow

  @spexor-id:spexor.verification-run-workflow.build
  Scenario: Build an explicit regression Run
    Given the specification catalog contains matching Scenarios
    When I filter and select Scenarios in the Run Builder
    Then the new Run should contain immutable snapshots of exactly those Scenarios

  @spexor-id:spexor.verification-run-workflow.complete
  Scenario: Complete a Run efficiently
    Given an active Run has unresolved Scenarios
    When I record results with keyboard shortcuts and save each row
    Then Spexor should advance to the next Scenario and show a completion summary

  @spexor-id:spexor.verification-run-workflow.retry
  Scenario: Retry unresolved outcomes
    Given a completed Run contains failed or blocked Scenarios
    When I retry failed and blocked outcomes
    Then Spexor should create a new Run linked to the original Run

  @spexor-id:spexor.verification-run-workflow.review-export
  Scenario: Review and export a completed Run
    Given a completed immutable Run is available
    When I filter its review or export Markdown, JSON, or JUnit
    Then the output should include Git context, summary, results, notes, and evidence
