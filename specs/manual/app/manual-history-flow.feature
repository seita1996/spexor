---
title: Manual history flow
environments:
  - mac-chrome
tags:
  - spexor
  - manual
priority: medium
owner: qa@spexor.local
verification:
  manualOnly: true
  automated: []
---

Feature: Spexor manual-only history flow

  Scenario: Review local and shared run history manually
    Given a manual-only feature has prior execution results
    When I open the scenario history dialog
    Then I should be able to compare local and shared history entries

  Scenario: Continue using manual sessions for manual-only features
    Given a feature is marked manual-only
    When I open its detail page
    Then I should still be able to start a feature session and inspect history
