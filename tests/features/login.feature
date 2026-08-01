Feature: WordPress login page
  As an anonymous visitor
  I want the WordPress login screen to render correctly and authenticate real users
  So that I know both the login UI and the authentication flow itself work

  @critical
  Scenario: The login screen exposes username, password and submit
    Given I am on the login page
    Then I should see the login form
    And the response status code should be 200

  # "admin" / "admin" is the administrator account this suite's own reference
  # install always provisions (see README's ddev setup and
  # .github/workflows/test.yml) — not a fixture-specific guess.
  @critical
  Scenario: A valid administrator can log in and reach an authenticated session
    Given I am on the login page
    When I log in as "admin" with password "admin"
    Then I should see the admin bar
    And the path should not be "/wp-login.php"

  Scenario: An incorrect password is rejected with WordPress's own error notice
    Given I am on the login page
    When I log in as "admin" with password "not-the-real-password"
    Then I should see "incorrect" in "#login_error" element
    And I should see the login form
