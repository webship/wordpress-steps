Feature: Navigation and blocks
  As a visitor
  I want to find my way through the site
  So that the navigation menu, the header and footer and the blocks of the theme are known to work

  Background:
    Given I am an anonymous user

  Scenario: The header and footer are rendered with the navigation
    Given I am on the homepage
    Then I should see the header template part
    And I should see the footer template part
    And I should see the "Navigation" block
    And I should see the "Site Title" block
    And I should see the "Query Loop" block

  Scenario: The navigation menu lists the pages and opens one
    Given I am on the homepage
    Then the navigation menu should list "Sample Page"
    And the navigation menu should not list "Privacy Policy"
    When I click "Sample Page" in the navigation menu
    Then "body" should have class "page"
    And I should see the "Post Title" block

  Scenario: The navigation menu opens on a phone
    Given I am on the homepage
    When I set the viewport to the "xs" breakpoint
    And I open the navigation menu
    And I click "Sample Page" in the navigation menu
    Then "body" should have class "page"

  Scenario: A post shows the blocks of a single entry
    Given I am on a post
    Then I should see the "Post Title" block
    And I should see the "Post Content" block
    And I should see the "Comments" block
    And I should not see the "Calendar" block
