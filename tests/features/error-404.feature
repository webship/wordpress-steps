Feature: WordPress 404 page
  As an anonymous visitor
  I want to see a proper 404 page for unknown URLs
  So that I know WordPress is handling missing content correctly

  Scenario: An unknown URL renders the 404 template
    # A non-existent post ID (rather than a guessed slug) 404s reliably
    # regardless of the site's permalink structure — under the default
    # "Plain" structure, an arbitrary unknown slug has no rewrite rule to
    # parse it as a content lookup at all, so it falls through to the
    # homepage instead of triggering is_404().
    Given I am on "/?p=999999999"
    Then I should be on the 404 page
    And the response status code should be 404
