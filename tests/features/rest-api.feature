Feature: REST API
  As a developer of a headless client or of the block editor
  I want the REST API to serve public content and to keep private routes private
  So that the API the editor depends on is known to work and not to leak

  Background:
    Given I am an anonymous user

  @critical
  Scenario: The REST API is available and advertised
    Given I am on the homepage
    Then the page should advertise the REST API
    And the REST API should be available

  Scenario: Published posts and pages are served as JSON
    Then the REST route "/wp/v2/posts" should respond with status 200
    And the REST route "/wp/v2/posts" should list at least 1 item
    And the REST route "/wp/v2/pages" should list at least 1 item
    And the REST route "/wp/v2/categories" should list at least 1 item

  Scenario: A post is served with its fields
    Then the REST route "/wp/v2/posts/1" should have "slug" equal to "hello-world"
    And the REST route "/wp/v2/posts/1" should have "status" equal to "publish"
    And the REST route "/wp/v2/posts/1" should have "title.rendered" equal to "Hello world!"
    And the REST route "/wp/v2/posts?search=Hello" should list at least 1 item

  Scenario: Private routes ask a visitor to log in
    Then the REST route "/wp/v2/users/me" should require authentication
    And the REST route "/wp/v2/settings" should require authentication
    And the REST route "/wp/v2/plugins" should require authentication
    And the REST route "/wp/v2/posts" should not require authentication

  Scenario: Drafts are not given to a visitor
    Then the REST route "/wp/v2/posts?status=draft" should be refused
    And the REST route "/wp/v2/posts?status=private" should be refused

  Scenario: An unknown route is a JSON 404
    Then the REST route "/wp/v2/no-such-route-qzx" should respond with status 404
    And the REST route "/wp/v2/posts/999999999" should respond with status 404

  Scenario: An administrator reads the private routes
    Given I am a logged in user with the "admin" user
    Then the REST route "/wp/v2/users/me" should respond with status 200
    And the REST route "/wp/v2/settings" should respond with status 200
    And the REST route "/wp/v2/plugins" should respond with status 200

  Scenario: An editor reads the account but not the plugins
    Given I am a logged in user with the "editor" user
    Then the REST route "/wp/v2/users/me" should respond with status 200
    And the REST route "/wp/v2/plugins" should respond with status 403
    And the REST route "/wp/v2/settings" should respond with status 403
