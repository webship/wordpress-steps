Feature: WordPress search
  As an anonymous visitor
  I want to search a WordPress site
  So that I can find content matching a term

  Scenario: Searching returns the WordPress search-results template
    Given I am on the homepage
    When I search the site for existing content
    Then I should see search results for that content
    And the response status code should be 200
