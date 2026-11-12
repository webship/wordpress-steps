@a11y
Feature: Accessibility
  As a site owner
  I want the main pages audited against the accessibility rules
  So that a theme or a plugin cannot quietly ship a serious violation

  Scenario Outline: A public page has the basics of an accessible document
    Given I am an anonymous user
    And I am on "<path>"
    Then the page should declare a language
    And the page should have a title
    And every image should have an alt attribute

    Examples:
      | path                      |
      | /                         |
      | /wp-login.php             |
      | /this-path-does-not-exist |

  Scenario Outline: A public page of the theme has one level-one heading
    Given I am an anonymous user
    And I am on "<path>"
    Then the page should have exactly one h1

    Examples:
      | path                      |
      | /                         |
      | /this-path-does-not-exist |

  Scenario: The front page has no critical accessibility violations
    Given I am an anonymous user
    And I am on the homepage
    Then the page should have no critical accessibility violations
    And the page should have a main landmark
    And the page should have a navigation landmark

  Scenario: A post has no critical accessibility violations
    Given I am an anonymous user
    And I am on a post
    Then the page should have no critical accessibility violations
    And the page should have exactly one h1

  Scenario: The login page has no critical accessibility violations
    Given I am an anonymous user
    And I am on the login page
    Then the page should have no critical accessibility violations
    And every form field should have an accessible label

  Scenario: The 404 page has no critical accessibility violations
    Given I am an anonymous user
    And I am on "/this-path-does-not-exist"
    Then the page should have no critical accessibility violations
