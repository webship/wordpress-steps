Feature: WordPress homepage
  As an anonymous visitor
  I want the WordPress front page to load correctly
  So that I know the site is up and rendering its core layout

  @critical
  Scenario: Homepage renders the front-page template
    Given I am an anonymous user
    And I am on the homepage
    Then I should be on the front page
    And the response status code should be 200

  Scenario: Homepage shows the core site layout
    Given I am on the homepage
    Then I should see the site title
    And I should see the primary navigation menu
    And I should see the footer
