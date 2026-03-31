---
title: Shopping cart
environments:
  - mac-chrome
  - mac-safari
  - android-chrome
tags:
  - commerce
  - checkout
priority: high
owner: product@example.com
related:
  - https://github.com/example/repo/issues/308
---

Feature: Shopping cart

  Scenario: Add an item to the cart
    Given I am viewing a product detail page
    When I add the product to the cart
    Then the cart count should increase by one

  Scenario: Remove an item from the cart
    Given I already have two items in the cart
    When I remove one item
    Then the removed item should no longer appear in the cart

  Scenario Outline: Cart totals stay consistent across shipping methods
    Given I have one in-stock item in the cart
    When I choose the <shipping_method> shipping method
    Then the cart total should include the <shipping_fee> surcharge

    Examples: Fulfillment options
      | shipping_method | shipping_fee |
      | standard        | standard     |
      | express         | express      |
