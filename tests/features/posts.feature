Feature: Single posts
  As an anonymous visitor
  I want a published post to be served on its own permalink
  So that the "post" post type and its template are known to work

  Scenario: A published post is served with the single template
    Given I am on a post
    Then the response status code should be 200
    And "body" should have class "single"
    And I should see the post title

  # Assumes comments are open on the most recent post, which is true for the default
  # "Hello world!" post. Drop this scenario if the site closes comments.
  Scenario: A post with open comments invites a visitor to reply
    Given I am on a post
    Then I should see the comment form
