---
id: spexor.manual-history
title: Manual history flow
domain: execution
lifecycle: active
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

  @spexor-id:spexor.manual-history.review
  Scenario: Review local and shared run history manually
    Given a manual-only feature has prior execution results
    When I open the scenario history dialog
    Then I should be able to compare local and shared history entries

  @spexor-id:spexor.manual-history.session
  Scenario: Continue using manual sessions for manual-only features
    Given a feature is marked manual-only
    When I open its detail page
    Then I should still be able to start a feature session and inspect history
