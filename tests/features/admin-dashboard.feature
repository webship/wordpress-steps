Feature: Dashboard and admin menu
  As a site administrator
  I want the dashboard, the admin menu and the admin bar to show what my role may use
  So that a broken administration area is caught before an editor finds it

  Background:
    Given I am a logged in user with the "admin" user

  @critical
  Scenario: The dashboard shows its widgets
    When I go to the "Dashboard" admin screen
    Then the page should return HTTP status 200
    And I should see the "At a Glance" dashboard widget
    And I should see the "Activity" dashboard widget
    And I should see the "Site Health Status" dashboard widget

  Scenario: The admin menu lists the sections of an administrator
    When I go to the "Dashboard" admin screen
    Then the admin menu should list "Posts"
    And the admin menu should list "Media"
    And the admin menu should list "Pages"
    And the admin menu should list "Comments"
    And the admin menu should list "Appearance"
    And the admin menu should list "Plugins"
    And the admin menu should list "Users"
    And the admin menu should list "Tools"
    And the admin menu should list "Settings"

  Scenario: The submenus list the screens of their section
    When I go to the "Dashboard" admin screen
    Then the "Posts" admin submenu should list "Categories"
    And the "Posts" admin submenu should list "Tags"
    And the "Settings" admin submenu should list "Permalinks"
    And the "Tools" admin submenu should list "Site Health"

  Scenario: The admin menu opens a section
    When I go to the "Dashboard" admin screen
    And I click "Posts" in the admin menu
    Then I should be on the "Posts" admin screen

  Scenario: The admin menu opens a screen of a submenu
    When I go to the "Dashboard" admin screen
    And I click "Permalinks" under "Settings" in the admin menu
    Then I should be on the "Permalinks" admin screen

  Scenario: The admin bar offers the actions of an administrator on the site
    When I go to the homepage
    Then the admin bar should list "Dashboard"
    And the admin bar should list "New"
    And the admin bar should list "Edit Site"

  Scenario: The admin bar offers to edit the entry being viewed
    Given I am on a post
    Then the admin bar should list "Edit Post"
    When I click "Edit Post" in the admin bar
    Then the path should be "/wp-admin/post.php"

  Scenario: An administration screen answers with a success notice after an action
    When I go to the "General Settings" admin screen
    And I save the settings
    Then I should see a success notice "Settings saved."
    And I should not see an error notice

  Scenario: An editor sees a smaller admin menu
    Given I am a logged in user with the "editor" user
    When I go to the "Dashboard" admin screen
    Then the admin menu should list "Posts"
    And the admin menu should list "Pages"
    And the admin menu should not list "Plugins"
    And the admin menu should not list "Settings"
    And the admin menu should not list "Appearance"

  Scenario: A subscriber sees the profile menu only
    Given I am a logged in user with the "subscriber" user
    Then the admin menu should list "Profile"
    And the admin menu should not list "Posts"

  Scenario: The All Settings screen warns the administrator
    Given I am on "/wp-admin/options.php"
    Then I should see a warning notice "direct access to your site settings"
    And I should not see an error notice

  Scenario: The theme file editor informs the administrator
    Given I am on "/wp-admin/theme-editor.php"
    Then I should see an info notice "Did you know?"
