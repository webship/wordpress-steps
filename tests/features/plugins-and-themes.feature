Feature: Plugins and themes
  As a site administrator
  I want to see which plugins and theme are installed and active
  So that a site running the wrong theme or a missing plugin is caught

  Background:
    Given I am a logged in user with the "admin" user

  Scenario: The Plugins screen lists the installed plugins
    When I go to the "Plugins" admin screen
    Then the page should return HTTP status 200
    And the "Hello Dolly" plugin should be installed
    And the "Hello Dolly" plugin should be inactive
    And the "No Such Plugin Qzx" plugin should not be installed

  Scenario: A plugin is activated and deactivated from its row
    When I activate the "Hello Dolly" plugin
    Then I should see a success notice "Plugin activated."
    And the "Hello Dolly" plugin should be active
    When I deactivate the "Hello Dolly" plugin
    Then I should see a success notice "Plugin deactivated."
    And the "Hello Dolly" plugin should be inactive

  Scenario: An editor may not use the Plugins screen
    Given I am a logged in user with the "editor" user
    When I go to the "Plugins" admin screen
    Then I should see the access denied screen

  Scenario: The Themes screen shows the active theme
    When I go to the "Themes" admin screen
    Then the page should return HTTP status 200
    And the "Twenty Twenty-Five" theme should be active
    And the "Twenty Twenty-Five" theme should be installed
    And the "Twenty Twenty-Four" theme should not be active
    And the "No Such Theme Qzx" theme should not be installed

  Scenario: The active theme is a block theme with the Site Editor
    Then the active theme should be a block theme
    And the active theme should not be a classic theme
    When I go to the "Editor" admin screen
    Then the page should return HTTP status 200
    And I should be on the "Editor" admin screen
