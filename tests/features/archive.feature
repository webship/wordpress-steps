Feature: WordPress category archive
  As an anonymous visitor
  I want a WordPress category archive to render correctly
  So that I know taxonomy archives are being served properly

  Scenario: A category archive renders the archive template
    Given I am on a category archive
    Then I should be on a "archive" page
    And the response status code should be 200
