---
title: Admin access
environments:
  - mac-chrome
  - linux-chrome
tags:
  - admin
  - security
priority: high
owner: security@example.com
related:
  - https://github.com/example/repo/issues/412
---

Feature: Admin access

  Scenario: Admin dashboard is available to privileged users
    Given I am logged in as an admin
    When I open the admin dashboard
    Then I should see the audit summary cards

  Scenario: Standard users are rejected from admin routes
    Given I am logged in as a standard user
    When I request the admin dashboard
    Then I should see an access denied page
