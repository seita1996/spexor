---
title: Responsive smoke checks
environments:
  - ios-safari
  - android-chrome
tags:
  - ui
  - smoke
priority: low
owner: design@example.com
related:
  - https://github.com/example/repo/issues/509
---

Feature: Responsive layout smoke checks

  Scenario Outline: Core pages render without layout breaks
    Given I open the <page_name> page on a <viewport> viewport
    When the page finishes loading
    Then I should not see horizontal overflow
    And the primary call to action should remain visible

    Examples: Mobile layout
      | page_name | viewport |
      | login     | mobile   |
      | signup    | mobile   |
      | cart      | mobile   |

    Examples: Tablet layout
      | page_name | viewport |
      | profile   | tablet   |
      | admin     | tablet   |
