---
title: Signup
browsers:
  - chrome
  - firefox
platforms:
  - mac
  - windows
tags:
  - auth
  - regression
priority: medium
owner: dev@example.com
related:
  - https://github.com/example/repo/discussions/77
---

Feature: Account signup

  Scenario: Signup with a fresh email address
    Given I open the signup page
    When I submit a unique email and valid password
    Then a verification email should be queued

  Scenario: Signup refuses a duplicated email
    Given an account already exists for the submitted email
    When I submit the signup form
    Then I should see a duplicate account warning
