Feature: Feeds, robots and sitemap
  As a site owner
  I want the feeds, robots.txt and the XML sitemap to be served
  So that feed readers and search engines can read the site

  Scenario: The page head links to the feed
    Given I am on the homepage
    Then the page should link to the site feed

  Scenario: The site feed is valid RSS and lists the content
    Then the site feed should be a valid RSS feed with at least 1 item
    And the site feed should list "Hello world!"

  Scenario: The comments feed is valid RSS
    Then the comments feed should be a valid RSS feed

  Scenario: A category feed is valid RSS
    Then the feed "/category/uncategorized/feed/" should be a valid RSS feed with at least 1 item

  Scenario: Robots.txt is served and keeps the administration area out
    Then robots.txt should be served
    And robots.txt should disallow "/wp-admin/"
    And robots.txt should not disallow "/"
    And robots.txt should list the sitemap

  Scenario: The XML sitemap is served and lists the content types
    Then the XML sitemap should be served
    And the XML sitemap should list "wp-sitemap-posts-post-1.xml"
    And the XML sitemap should list "wp-sitemap-posts-page-1.xml"
