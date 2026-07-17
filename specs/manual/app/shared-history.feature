---
id: spexor.shared-history
title: Shared history sync
domain: history
lifecycle: active
environments:
  - mac-chrome
tags:
  - spexor
  - shared-results
priority: medium
owner: qa@spexor.local
verification:
  manualOnly: true
  automated: []
---

Feature: Spexor shared history sync

  @spexor-id:spexor.shared-history.refresh
  Scenario: Refresh shared history from a feature detail page
    Given shared results are configured for the project
    When I sync shared history from a scenario dialog
    Then I should see the comparison view refresh without losing local history

  @spexor-id:spexor.shared-history.local-only
  Scenario: Continue in local-only mode when shared sync is unavailable
    Given shared sync is not configured or currently failing
    When I inspect a feature's scenario history
    Then local history should still be available for manual review
