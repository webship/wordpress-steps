Feature: Accounts and roles
  As a site owner
  I want each role to log in, land where WordPress sends it and be refused what it may not do
  So that the accounts a site depends on are known to work and to stay inside their role

  Scenario Outline: Each role logs in as its own account and lands on its screen
    Given I am a logged in user with the "<handle>" user
    Then I should be logged in as the "<handle>" user
    And my account should have the "<role>" role
    And I should be on the "<landing>" admin screen
    And I should see the admin bar

    Examples:
      | handle      | role          | landing   |
      | admin       | administrator | Dashboard |
      | editor      | editor        | Dashboard |
      | author      | author        | Dashboard |
      | contributor | contributor   | Dashboard |
      | subscriber  | subscriber    | Profile   |

  Scenario Outline: A role without the capability is refused an administration screen
    Given I am a logged in user with the "<handle>" user
    When I go to the "<screen>" admin screen
    Then I should see the access denied screen
    And the page should return HTTP status 403

    Examples:
      | handle      | screen        |
      | subscriber  | Posts         |
      | contributor | Plugins       |
      | author      | Plugins       |
      | editor      | Plugins       |
      | editor      | Users         |
      | author      | Pages         |

  Scenario Outline: A role with the capability opens an administration screen
    Given I am a logged in user with the "<handle>" user
    When I go to the "<screen>" admin screen
    Then I should not see the access denied screen
    And the page should not return HTTP status 403
    And I should be on the "<screen>" admin screen
    And I should not be on the "Dashboard" admin screen

    Examples:
      | handle      | screen   |
      | editor      | Pages    |
      | author      | Posts    |
      | contributor | Posts    |
      | admin       | Plugins  |

  Scenario: The dashboard shows an editor what an editor may use
    Given I am a logged in user with the "editor" user
    When I go to the "Dashboard" admin screen
    Then I should see the "Activity" dashboard widget
    And I should not see the "Site Health Status" dashboard widget
    And the "Posts" admin submenu should list "Categories"

  Scenario: An author's menus leave out what an author may not use
    Given I am a logged in user with the "author" user
    When I go to the "Dashboard" admin screen
    Then the "Posts" admin submenu should list "Add Post"
    And the "Posts" admin submenu should not list "Categories"
    And the admin bar should list "New"

  Scenario: A subscriber's admin bar offers nothing to create
    Given I am a logged in user with the "subscriber" user
    Then the admin bar should not list "New"

  Scenario: An account does not have a role it was not given
    Given I am a logged in user with the "editor" user
    Then my account should not have the "administrator" role
    And my account should have the "editor" role

  Scenario: The account menu of the admin bar names the logged-in account
    Given I am a logged in user with the "editor" user
    When I go to the homepage
    Then the admin bar should show the account "editor"
    And the admin bar should not show the account "subscriber"

