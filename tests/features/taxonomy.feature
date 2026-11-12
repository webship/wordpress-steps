Feature: Categories and tags
  As an editor
  I want to add categories and tags and file a post under them
  So that the taxonomy screens and the editor sidebar are known to work with the public site

  Scenario: A category is added, used by a post, shown on the site and removed
    Given I am a logged in user with the "editor" user
    When I add the category "Webship reports"
    Then the category "Webship reports" should exist
    When I am on the new post screen
    And I set the post title to "Webship categorised post"
    And I write "A post in a category." in the post content
    And I file the post under the category "Webship reports"
    And I publish the post
    And I view the post
    Then the post should be in the category "Webship reports"
    When I move the post "Webship categorised post" to the trash from the list
    And I delete the post "Webship categorised post" permanently
    And I delete the category "Webship reports"
    Then the category "Webship reports" should not exist

  Scenario: A tag is added in the editor, shown on the site and removed
    Given I am a logged in user with the "editor" user
    And I am on the new post screen
    When I set the post title to "Webship tagged post"
    And I write "A post with a tag." in the post content
    And I tag the post with "webship-tag"
    And I publish the post
    And I view the post
    Then the post should be in the tag "webship-tag"
    When I move the post "Webship tagged post" to the trash from the list
    And I delete the post "Webship tagged post" permanently
    And I delete the tag "webship-tag"
    Then the tag "webship-tag" should not exist

  Scenario: A tag is added on its screen
    Given I am a logged in user with the "editor" user
    When I add the tag "webship-screen-tag"
    Then the tag "webship-screen-tag" should exist
    When I delete the tag "webship-screen-tag"
    Then the tag "webship-screen-tag" should not exist

  Scenario: A contributor may not manage categories
    Given I am a logged in user with the "contributor" user
    When I go to the "Categories" admin screen
    Then I should see the access denied screen
