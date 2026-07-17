---
id: spexor.explore-mode
title: Explore specifications
domain: discovery
lifecycle: active
environments:
  - mac-chrome
tags:
  - spexor
  - explore
priority: high
owner: qa@spexor.local
verification:
  manualOnly: false
  automated:
    - runner: vitest
      file: apps/spexor/src/pages/SpecWorkspacePage.test.tsx
      tests:
        - "SpecWorkspacePage > shows a searchable spec explorer and selected scenario workspace"
        - "SpecWorkspacePage > opens a scenario from its Explore deep link"
---

Feature: Explore specifications

  @spexor-id:spexor.explore-mode.filter
  Scenario: Narrow the read-only specification catalog
    Given version-controlled Features and Scenarios are available
    When I search and filter by metadata, identity source, or latest status
    Then I should see only matching Scenarios in the three-pane workspace

  @spexor-id:spexor.explore-mode.deep-link
  Scenario: Open a Scenario deep link
    Given a teammate shares an Explore Scenario URL
    When I open the URL
    Then I should see that Scenario selected with its context and history

  @spexor-id:spexor.explore-mode.start-run
  Scenario: Start a Run from Explore
    Given I have selected a Scenario, Feature, or filtered result set
    When I start a Run
    Then Spexor should snapshot exactly the selected Scenarios
