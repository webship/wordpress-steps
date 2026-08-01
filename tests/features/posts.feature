Feature: WordPress single posts
  As an anonymous visitor
  I want a single WordPress blog post to render correctly
  So that I know the "post" post type is being served properly

  Scenario: A single post renders the post template
    Given I am on a post
    Then I should be on a "single" page
    And the response status code should be 200
    And I should see the post title

  # Assumes the most recent published post has comments open — true for the
  # "Hello world!" post on any untouched default `wp core install`. Remove
  # this scenario if running against a site that has closed comments on its
  # latest post.
  Scenario: A single post with open comments shows the comment form
    Given I am on a post
    Then I should see the comment form
