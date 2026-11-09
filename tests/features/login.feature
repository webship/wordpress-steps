Feature: Authentication
  As a site administrator
  I want the login screen to render and authenticate real users
  So that both the login UI and the session it creates are known to work

  @critical
  Scenario: The login screen is served with its form
    Given I am on the login page
    Then the response status code should be 200
    And I should see the login form

  # Credentials come from worldParameters.users in cucumber.js (overridable
  # with WP_ADMIN_USER / WP_ADMIN_PASSWORD), so no password appears here.
  @critical
  Scenario: Valid credentials start an authenticated session
    Given I am a logged in user with the username "admin"
    Then I should see the admin bar
    And the path should not be "/wp-login.php"

  Scenario: An authenticated session carries onto the front end
    Given I am a logged in user with the username "admin"
    When I go to the homepage
    Then I should see the admin bar

  # The wrong password is the subject here, so it is named inline.
  Scenario: An incorrect password is rejected and the form is offered again
    Given I am on the login page
    When I log in as "admin" with password "not-the-real-password"
    Then I should see "incorrect" in "#login_error" element
    And I should see the login form

  Scenario: An anonymous visitor has no authenticated session
    Given I am an anonymous user
    And I am on the homepage
    Then I should not see the admin bar

  Scenario: Ending the session returns the visitor to the login form
    Given I am a logged in user with the username "admin"
    And I am not logged in
    Then I should see the login form
    When I go to the homepage
    Then I should not see the admin bar
