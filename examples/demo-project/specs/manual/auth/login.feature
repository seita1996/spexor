---
id: authentication.login
title: Login
domain: authentication
lifecycle: active
environments:
  - mac-chrome
  - mac-safari
  - ios-safari
tags:
  - auth
  - smoke
priority: high
owner: qa@example.com
related:
  - https://github.com/example/repo/issues/123
---

Feature: User login

  Background:
    Given a registered user exists
    And the login page is reachable

  @spexor-id:authentication.login.valid-credentials
  Scenario: Login with valid credentials
    Given I open the login page
    When I submit valid email and password
    Then I should see the dashboard

  @spexor-id:authentication.login.failure-message
  Scenario Outline: Login failures are explained clearly
    Given I open the login page
    When I submit a valid email and <credential_state>
    Then I should see the <message_type> message

    Examples: Credential failures
      | credential_state   | message_type        |
      | invalid password   | authentication      |
      | expired one-time code | recovery guidance |
