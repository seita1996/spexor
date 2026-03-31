---
title: Profile update
environments:
  - mac-chrome
  - windows-edge
tags:
  - profile
  - account
priority: medium
owner: qa@example.com
related:
  - https://github.com/example/repo/issues/201
---

Feature: Profile update

  Background:
    Given I am logged in as a standard user
    And I am on the profile settings page

  Scenario: Save profile changes
    When I change my display name and timezone
    Then the updated profile should be visible after refresh

  Scenario: Validation appears for an empty display name
    When I clear the display name and save the form
    Then I should see an inline validation error
