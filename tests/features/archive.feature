Feature: Category archives
  As an anonymous visitor
  I want a category archive to list the posts filed under it
  So that taxonomy routing and the archive loop are known to work

  Scenario: A category archive is served with the archive template
    Given I am on a category archive
    Then the response status code should be 200
    And "body" should have class "archive"
    And I should see the content title

  Scenario: A category archive lists at least one entry
    Given I am on a category archive
    Then "article" should be visible
