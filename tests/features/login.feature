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
  # with WP_ADMIN_USER and WP_ADMIN_PASSWORD), so no password appears here.
  @critical
  Scenario: Valid credentials start an authenticated session
    Given I am a logged in user with the username "admin"
    Then I should be logged in
    And I should be logged in as the "admin" user
    And I should see the admin bar
    And the path should not be "/wp-login.php"

  Scenario: An authenticated session carries onto the front end
    Given I am a logged in user with the username "admin"
    When I go to the homepage
    Then I should see the admin bar
    And I should be logged in

  # The wrong password is the subject here, so it is named inline. The account
  # is the registry's, so the message is the one WordPress gives a real user.
  Scenario: An incorrect password is rejected and the form is offered again
    Given I am on the login page
    When I log in as the "admin" user with password "not-the-real-password"
    Then I should see a login error "incorrect"
    And I should see the login form
    And I should not be logged in

  Scenario: An unknown account is rejected
    Given I am on the login page
    When I log in as "no-such-account-qzx" with password "whatever"
    Then I should see a login error "not registered"
    And I should not be logged in

  Scenario: An anonymous visitor has no authenticated session
    Given I am an anonymous user
    And I am on the homepage
    Then I should not see the admin bar
    And I should not be logged in

  Scenario: An anonymous visitor is sent to the login page from the dashboard
    Given I am an anonymous user
    When I go to the "Dashboard" admin screen
    Then I should be on the login page
    And I should see the login form

  Scenario: Ending the session returns the visitor to the login form
    Given I am a logged in user with the username "admin"
    And I am not logged in
    Then I should see the login form
    And I should not be logged in
    When I go to the homepage
    Then I should not see the admin bar

  Scenario: Logging out ends the session the way a user does
    Given I am a logged in user with the "admin" user
    When I log out
    Then I should see a login message "logged out"
    And I should see the login form
    And I should not be logged in
    When I go to the "Dashboard" admin screen
    Then I should be on the login page

  Scenario: The lost password screen takes a username and acknowledges the request
    Given I am on the lost password page
    When I request a password reset for the "subscriber" user
    Then I should see a login message "Check your email"
