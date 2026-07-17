---
id: authentication.signup
title: Signup
domain: authentication
lifecycle: active
environments:
  - mac-chrome
  - windows-firefox
tags:
  - auth
  - regression
priority: medium
owner: dev@example.com
related:
  - https://github.com/example/repo/discussions/77
---

Feature: Account signup

  @spexor-id:authentication.signup.fresh-email
  Scenario: Signup with a fresh email address
    Given I open the signup page
    When I submit a unique email and valid password
    Then a verification email should be queued

  @spexor-id:authentication.signup.duplicate-email
  Scenario: Signup refuses a duplicated email
    Given an account already exists for the submitted email
    When I submit the signup form
    Then I should see a duplicate account warning
