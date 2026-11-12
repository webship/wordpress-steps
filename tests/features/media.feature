Feature: Media library
  As an author
  I want to upload files to the media library
  So that uploads, the library list and the removal of a file are known to work

  Scenario: A file is uploaded, listed in the library and deleted
    Given I am a logged in user with the "author" user
    When I upload the media file "webshipco.png"
    Then the media library should list "webshipco"
    When I delete the media file "webshipco" permanently
    Then the media library should not list "webshipco"

  Scenario: A document is uploaded and deleted
    Given I am a logged in user with the "author" user
    When I upload the media file "test-document.pdf"
    Then the media library should list "test-document"
    When I delete the media file "test-document" permanently
    Then the media library should not list "test-document"

  Scenario: A contributor may not upload files
    Given I am a logged in user with the "contributor" user
    When I go to the "Add Media File" admin screen
    Then I should see the access denied screen
