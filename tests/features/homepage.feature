Feature: Homepage
  As an anonymous visitor
  I want the front page to load and render its core layout
  So that a broken theme, a fatal error or a missing menu is caught first

  Background:
    Given I am an anonymous user

  @critical
  Scenario: The front page is served and uses the home template
    Given I am on the homepage
    Then the response status code should be 200
    And "body" should have class "home"
    And I should see the site title

  Scenario: The front page exposes the site's primary landmarks
    Given I am on the homepage
    Then the page should have a navigation landmark
    And "footer" should be visible

  Scenario: The front page renders without JavaScript errors
    Given I am on the homepage
    Then there should be no JavaScript errors

  Scenario: The front page keeps its landmarks on a phone viewport
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    Then the page should have a navigation landmark
    And "footer" should be visible
