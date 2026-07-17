---
id: spexor.commit-aware-run
title: Commit-aware verification runs
domain: execution
lifecycle: active
environments:
  - mac-chrome
tags:
  - spexor
  - run
  - git
priority: high
owner: qa@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: packages/git/src/index.test.ts
      tests:
        - "@spexor/git > captures branch, commit, and dirty state from a Git repository"
        - "@spexor/git > falls back cleanly outside Git repositories"
    - runner: vitest
      file: packages/db/src/index.test.ts
      tests:
        - "@spexor/db > initializes SQLite and persists scenario run history"
    - runner: vitest
      file: apps/spexor/src/pages/SpecWorkspacePage.test.tsx
      tests:
        - "SpecWorkspacePage > keeps deleted specifications readable from immutable run snapshots"
---

Feature: Commit-aware verification runs

  @spexor-id:spexor.commit-aware-run.capture-git
  Scenario: Capture the verified Git state
    Given I create a Run inside a Git repository
    When Spexor snapshots the Run context
    Then I should see the branch, commit SHA, and dirty state

  @spexor-id:spexor.commit-aware-run.detect-stale
  Scenario: Detect a changed specification
    Given a Run contains an immutable Scenario fingerprint
    When the active specification changes after Run creation
    Then I should see the Run item marked stale

  @spexor-id:spexor.commit-aware-run.keep-deleted
  Scenario: Read a Run after its source specification is deleted
    Given a Run contains immutable titles and steps
    When the source Scenario is no longer available
    Then I should still be able to review the captured Run content
