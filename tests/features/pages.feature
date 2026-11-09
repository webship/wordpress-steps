Feature: Static pages
  As an anonymous visitor
  I want a published page to be served on its own permalink
  So that the "page" post type and its template are known to work

  Scenario: A published page is served with the page template
    Given I am on a page
    Then the response status code should be 200
    And "body" should have class "page"
    And I should see the page title
