Feature: Site Health and cron
  As a site administrator
  I want Site Health and the cron endpoint to report a working site
  So that scheduled tasks, the REST API and outgoing requests are known to run

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: Site Health reports that scheduled events run
    When I go to the "Site Health" admin screen
    Then the site health test "Scheduled events are running" should pass
    And the site health test "The REST API is available" should pass
    And the site health test "Your site can perform loopback requests" should pass

  Scenario: Site Health reports that search engines may index the site
    When I go to the "Site Health" admin screen
    Then the site health test "Search engine indexing is enabled." should pass

  Scenario: The cron endpoint answers without error
    Then the cron should respond

  Scenario: Site Health recommends removing what a default install leaves inactive
    When I go to the "Site Health" admin screen
    Then the site health test "You should remove inactive plugins" should be recommended
