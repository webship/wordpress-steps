Feature: Search
  As an anonymous visitor
  I want to search the site
  So that the matching and the empty result paths, and the search form itself, are known to work

  Background:
    Given I am an anonymous user

  Scenario: Searching for content that exists returns the results template
    Given I am on the homepage
    When I search the site for existing content
    Then the response status code should be 200
    And I should see search results for that content
    And I should see post entries

  Scenario: The results list the matching entry
    Given I am on the homepage
    When I search the site for existing content
    Then the search results should include "Hello"

  Scenario: Searching for a term with no matches is an empty result, not an error
    Given I am on the homepage
    When I search the site for "qzxjvwk-no-such-content"
    Then the response status code should be 200
    And I should see no search results for "qzxjvwk-no-such-content"
    And "body" should have class "search-no-results"

  Scenario: The search results page offers the search form
    When I search the site for existing content
    Then I should see the search form

  Scenario: The search form submits a new search
    When I search the site for "qzxjvwk-no-such-content"
    And I use the search form to search for "Hello"
    Then I should see search results for "Hello"
    And the search results should include "Hello world"

  Scenario: The 404 page offers the search form
    Given I am on "/this-path-does-not-exist"
    Then the response status code should be 404
    And I should see the search form
