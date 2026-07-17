---
id: admin.access
title: Admin access
domain: administration
lifecycle: active
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

  @spexor-id:admin.access.dashboard
  Scenario: Admin dashboard is available to privileged users
    Given I am logged in as an admin
    When I open the admin dashboard
    Then I should see the audit summary cards

  @spexor-id:admin.access.rejected
  Scenario: Standard users are rejected from admin routes
    Given I am logged in as a standard user
    When I request the admin dashboard
    Then I should see an access denied page
