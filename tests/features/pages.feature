Feature: Static pages
  As an anonymous visitor
  I want a published page to be served on its own permalink
  So that the "page" post type and its template are known to work

  Scenario: A published page is served with the page template
    Given I am on a page
    Then the response status code should be 200
    And "body" should have class "page"
    And I should see the page title

  # Assumes comments are closed on the page, which is true for the default
  # "Sample Page". Drop this scenario if the site opens comments on pages.
  Scenario: A page with closed comments offers no comment form
    Given I am on a page
    Then I should not see a comment form
