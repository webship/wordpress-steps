Feature: Settings
  As a site administrator
  I want to change the site title and the permalink structure
  So that the settings screens save what they are given and the site follows

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: The site title is changed, shown on the site, and changed back
    When I go to the "General Settings" admin screen
    And I change the "Site Title" setting to "Webship Review Site"
    And I save the settings
    Then I should see a success notice "Settings saved."
    And the "Site Title" setting should be "Webship Review Site"
    When I go to the homepage
    Then I should see the site title "Webship Review Site"
    When I go to the "General Settings" admin screen
    And I restore the "Site Title" setting
    And I save the settings
    Then I should see a success notice "Settings saved."
    And the "Site Title" setting should not be "Webship Review Site"

  Scenario: The permalink structure is changed, saved, and restored
    When I choose the "Post name" permalink structure
    And I save the settings
    Then I should see a success notice "Permalink structure updated."
    And the permalink structure should be "Post name"
    When I restore the permalink structure
    Then I should see a success notice "Permalink structure updated."
    And the permalink structure should not be "Post name"

  Scenario: Settings screens exist for each area
    When I go to the "Reading Settings" admin screen
    Then the page should return HTTP status 200
    When I go to the "Discussion Settings" admin screen
    Then the page should return HTTP status 200
    When I go to the "Media Settings" admin screen
    Then the page should return HTTP status 200

  Scenario: An editor may not change settings
    Given I am a logged in user with the "editor" user
    When I go to the "General Settings" admin screen
    Then I should see the access denied screen
