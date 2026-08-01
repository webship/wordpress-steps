Feature: WordPress static pages
  As an anonymous visitor
  I want static WordPress Pages to render correctly
  So that I know the "page" post type is being served properly

  Scenario: A static page renders the page template
    Given I am on a page
    Then I should be on a "page" page
    And the response status code should be 200
    And I should see the site title
    And I should see the footer
