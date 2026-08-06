Feature: Search
  As an anonymous visitor
  I want to search the site
  So that both the matching and the empty result paths are known to work

  Scenario: Searching for content that exists returns the results template
    Given I am on the homepage
    When I search the site for existing content
    Then the response status code should be 200
    And I should see search results for that content

  Scenario: Searching for a term with no matches still returns a results page
    Given I am on the homepage
    When I search the site for "qzxjvwk-no-such-content"
    Then the response status code should be 200
    And I should see search results for "qzxjvwk-no-such-content"
    # Core sets this class when is_search() has no matches. Counting entries
    # would not work: themes render a "More posts" block on empty results.
    And "body" should have class "search-no-results"
