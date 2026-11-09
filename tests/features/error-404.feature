Feature: Missing content
  As an anonymous visitor
  I want unknown URLs to return a real 404
  So that missing content is never served as a soft 200

  Scenario: An unknown post ID returns a 404 response and template
    Given I am on "/?p=999999999"
    Then the response status code should be 404
    And "body" should have class "error404"

  Scenario: An unknown path returns a 404 response
    Given I am on "/this-path-does-not-exist"
    Then the response status code should be 404
