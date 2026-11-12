Feature: Comments
  As a visitor
  I want to comment on a post and see it after a moderator approved it
  So that the comment form and the moderation workflow are known to work

  Scenario: A visitor comment is held for moderation, approved and shown
    Given I am an anonymous user
    And I am on a post
    When I submit the comment "Webship visitor comment A"
    Then the comment "Webship visitor comment A" should be awaiting moderation
    Given I am a logged in user with the "editor" user
    Then the comment "Webship visitor comment A" should be pending
    And the comment "Webship visitor comment A" should not be approved
    When I approve the comment "Webship visitor comment A"
    Then the comment "Webship visitor comment A" should be approved
    And the comment "Webship visitor comment A" should not be pending
    Given I am an anonymous user
    And I am on a post
    Then I should see the comment "Webship visitor comment A"
    Given I am a logged in user with the "editor" user
    When I trash the comment "Webship visitor comment A"
    Then the comment "Webship visitor comment A" should be in the trash
    When I delete the comment "Webship visitor comment A" permanently
    Then the comment "Webship visitor comment A" should not be in the trash

  Scenario: A comment from an editor is published without moderation
    Given I am a logged in user with the "editor" user
    And I am on a post
    When I submit the comment "Webship editor comment B"
    Then I should see the comment "Webship editor comment B"
    And the comment "Webship editor comment B" should not be awaiting moderation
    When I trash the comment "Webship editor comment B"
    And I delete the comment "Webship editor comment B" permanently
    Then the comment "Webship editor comment B" should not be approved

  Scenario: A moderator marks a comment as spam
    Given I am an anonymous user
    And I am on a post
    When I submit the comment "Webship spam comment C" as "Spam Sender" with the email "info@webship.co"
    Given I am a logged in user with the "editor" user
    When I spam the comment "Webship spam comment C"
    Then the comment "Webship spam comment C" should be spam
    And the comment "Webship spam comment C" should not be pending
    When I delete the comment "Webship spam comment C" permanently
    Then the comment "Webship spam comment C" should not be spam

  Scenario: A subscriber may not moderate comments
    Given I am a logged in user with the "subscriber" user
    When I go to the "Comments" admin screen
    Then I should see the access denied screen

  Scenario: A moderator unapproves a comment and restores it from the trash
    Given I am a logged in user with the "editor" user
    And I am on a post
    When I submit the comment "Webship editor comment D"
    Then the comment "Webship editor comment D" should be approved
    When I unapprove the comment "Webship editor comment D"
    Then the comment "Webship editor comment D" should be pending
    And the comment "Webship editor comment D" should not be approved
    When I trash the comment "Webship editor comment D"
    Then the comment "Webship editor comment D" should be in the trash
    When I restore the comment "Webship editor comment D"
    Then the comment "Webship editor comment D" should not be in the trash
    And the comment "Webship editor comment D" should be pending
    When I trash the comment "Webship editor comment D"
    And I delete the comment "Webship editor comment D" permanently
    Then the comment "Webship editor comment D" should not be in the trash
