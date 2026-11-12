Feature: Posts and pages in the block editor
  As an editor
  I want to create, publish, update and trash posts and pages in the block editor
  So that the content workflow of the site is known to work from the editor to the public page

  Scenario: A post is created, published, shown on the site, updated and removed
    Given I am a logged in user with the "editor" user
    And I am on the new post screen
    When I set the post title to "Webship lifecycle post"
    And I write "First paragraph of the lifecycle post." in the post content
    And I publish the post
    Then I should see the editor notice "Post published."
    And the post should be published in the editor
    When I view the post
    Then I should see "Webship lifecycle post"
    And I should see "First paragraph of the lifecycle post."
    And the admin bar should list "Edit Post"
    When I open the post "Webship lifecycle post" in the editor
    And I write "Second paragraph added by an update." in the post content
    And I update the post
    Then I should see the editor notice "Post updated."
    When I view the post
    Then I should see "Second paragraph added by an update."
    When I open the post "Webship lifecycle post" in the editor
    And I move the post to the trash
    Then I should see a success notice "moved to the Trash"
    And the post "Webship lifecycle post" should be in the trash
    And the posts list should not include "Webship lifecycle post"
    When I delete the post "Webship lifecycle post" permanently
    Then the post "Webship lifecycle post" should not be in the trash

  Scenario: A published post is visible to a visitor and a trashed post is not
    Given I am a logged in user with the "admin" user
    And I am on the new post screen
    When I set the post title to "Webship visitor post"
    And I write "Visible to everyone." in the post content
    And I publish the post
    And I view the post
    And I am not logged in
    And I search the site for "Webship visitor post"
    Then I should see search results for "Webship visitor post"
    And the search results should include "Webship visitor post"
    Given I am a logged in user with the "admin" user
    When I move the post "Webship visitor post" to the trash from the list
    And I am not logged in
    And I search the site for "Webship visitor post"
    Then I should see no search results for "Webship visitor post"
    Given I am a logged in user with the "admin" user
    When I delete the post "Webship visitor post" permanently
    Then the post "Webship visitor post" should not be in the trash

  Scenario: A draft is saved, listed as a draft and not published
    Given I am a logged in user with the "author" user
    And I am on the new post screen
    When I set the post title to "Webship draft post"
    And I write "Work in progress." in the post content
    And I save the post as a draft
    Then the post should be a draft in the editor
    And the post "Webship draft post" should be a draft
    And the post "Webship draft post" should not be published
    When I move the post "Webship draft post" to the trash from the list
    And I delete the post "Webship draft post" permanently
    Then the posts list should not include "Webship draft post"

  Scenario: A page is created, published, shown on the site and removed
    Given I am a logged in user with the "editor" user
    And I am on the new page screen
    When I set the page title to "Webship lifecycle page"
    And I write "Body of the lifecycle page." in the page content
    And I publish the page
    Then I should see the editor notice "Page published."
    When I view the page
    Then I should see "Webship lifecycle page"
    And the pages list should include "Webship lifecycle page"
    When I move the page "Webship lifecycle page" to the trash from the list
    Then the page "Webship lifecycle page" should be in the trash
    When I restore the page "Webship lifecycle page" from the trash
    Then the page "Webship lifecycle page" should be a draft
    And the page "Webship lifecycle page" should not be in the trash
    When I move the page "Webship lifecycle page" to the trash from the list
    And I delete the page "Webship lifecycle page" permanently
    Then the pages list should not include "Webship lifecycle page"

  Scenario: A contributor submits a post for review and an editor sees it pending
    Given I am a logged in user with the "contributor" user
    And I am on the new post screen
    When I set the post title to "Webship reviewed post"
    And I write "Needs an editor." in the post content
    And I submit the post for review
    Then the post should be pending review in the editor
    And the post should not be published in the editor
    Given I am a logged in user with the "editor" user
    Then the post "Webship reviewed post" should be pending review
    # The editor does not take the post over while the contributor's editing
    # lock is held, so the contributor removes their own submission.
    Given I am a logged in user with the "contributor" user
    When I move the post "Webship reviewed post" to the trash from the list
    And I delete the post "Webship reviewed post" permanently
    Then the posts list should not include "Webship reviewed post"

  Scenario: A contributor is offered review, not publication
    Given I am a logged in user with the "contributor" user
    And I am on the new post screen
    When I set the post title to "Webship blocked post"
    And I write "Never published." in the post content
    Then the editor should offer "Submit for Review"
    And the editor should not offer "Publish"

  Scenario: An editor opens a page in the editor and sees it published
    Given I am a logged in user with the "editor" user
    When I open the page "Sample Page" in the editor
    Then the page should be published in the editor
    And the editor should offer "Save"
