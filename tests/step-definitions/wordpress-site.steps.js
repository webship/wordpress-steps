'use strict';

// WordPress step definitions for webship-js: what the theme renders.
//
// The navigation menu, core blocks by name, the template parts of a block
// theme (header and footer), and the links WordPress puts in the page head
// (the REST API, the feeds).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  expectText,
  expectRendered,
} = require('./wordpress-helpers');

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

// The links of the site's navigation menus: the Navigation block of a block
// theme, `#site-navigation` and `.main-navigation` of classic themes.
const NAVIGATION_LINKS = '.wp-block-navigation a, #site-navigation a, nav.main-navigation a, nav.navigation a';

/**
 * Assert the site's navigation menu has, or does not have, a link by its text.
 * It covers the Navigation block (block themes) and the primary menu of a
 * classic theme, in the header and the footer.
 *
 * Example #1: Then the navigation menu should list "Sample Page"
 * Example #2: And the navigation menu should list "Blog"
 * Example #3: Then the navigation menu should not list "Privacy Policy"
 * Example #4: And the navigation menu should not list "Admin"
 * Example #5: Then the navigation menu should list "About"
 *
 */
Then(/^the navigation menu should( not)* list "([^"]*)"$/, async function (notCase, label) {
  const links = this.page.locator(NAVIGATION_LINKS);
  await expectText(links, label, notCase, {
    label: 'the links of the navigation menu',
    hint: 'A block theme lists the pages of the site, or the Navigation block\'s own links; a classic theme needs a menu assigned to its primary location (Appearance > Menus).',
    timeout: budget(this),
  });
});

/**
 * Open the navigation menu of a small screen: the menu button the Navigation
 * block shows below its breakpoint. Resize first, for example with: When I set
 * the viewport to the "xs" breakpoint.
 *
 * Example #1: When I open the navigation menu
 * Example #2: When we open the navigation menu
 * Example #3: And I open the navigation menu
 * Example #4: When I open the mobile menu
 * Example #5: And we open the mobile menu
 *
 */
When(/^(I |we )*open the (?:navigation|mobile) menu$/, async function (pronounCase) {
  const button = this.page.locator('.wp-block-navigation__responsive-container-open, button.menu-toggle').filter({ visible: true }).first();
  await expectRendered(button, false, {
    label: 'the menu button of a small screen',
    hint: 'The button shows only below the theme\'s breakpoint. Resize first: When I set the viewport to the "xs" breakpoint.',
    timeout: budget(this),
  });
  await button.click();
  await settle(this);
});

/**
 * Follow a link of the navigation menu, by its text. On a small screen it
 * opens the menu first.
 *
 * Example #1: When I click "Sample Page" in the navigation menu
 * Example #2: When we click "Blog" in the navigation menu
 * Example #3: And I click "About" in the navigation menu
 * Example #4: When I click "Privacy Policy" in the navigation menu
 * Example #5: And we click "Contact" in the navigation menu
 *
 */
When(/^(I |we )*click "([^"]*)" in the navigation menu$/, async function (pronounCase, label) {
  let link = this.page.locator(NAVIGATION_LINKS).filter({ hasText: label }).filter({ visible: true }).first();
  if (!(await link.count())) {
    const open = this.page.locator('.wp-block-navigation__responsive-container-open').filter({ visible: true }).first();
    if (await open.count()) {
      await open.click();
      link = this.page.locator(NAVIGATION_LINKS).filter({ hasText: label }).filter({ visible: true }).first();
    }
  }
  await expectRendered(link, false, {
    label: `the navigation link "${label}"`,
    hint: 'Name the link as the menu shows it. The header and footer menus are both searched.',
    timeout: budget(this),
  });
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), link.click()]);
  await settle(this);
});

// ---------------------------------------------------------------------------
// Blocks and template parts
// ---------------------------------------------------------------------------

// Blocks whose title differs from the name of their class.
const BLOCK_CLASS_ALIASES = {
  'query loop': 'query',
  'social icons': 'social-links',
};

/**
 * Assert the page renders a core block, by its name: "Search", "Navigation",
 * "Site Title", "Post Title", "Query Loop", "Comments", "Latest Posts" and the
 * others. A core block renders with the class `wp-block-` and its name in
 * lower case with hyphens ("Post Title" is `.wp-block-post-title`; "Query Loop"
 * is `.wp-block-query`). The class is in the page of a block theme and of a classic theme that uses the block.
 *
 * Example #1: Then I should see the "Search" block
 * Example #2: And we should see the "Navigation" block
 * Example #3: Then I should see the "Post Title" block
 * Example #4: And I should not see the "Latest Posts" block
 * Example #5: But we should not see the "Calendar" block
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" block$/, async function (pronounCase, notCase, name) {
  const lower = String(name).trim().toLowerCase();
  const slug = BLOCK_CLASS_ALIASES[lower] || lower.replace(/[^a-z0-9]+/g, '-');
  await expectRendered(this.page.locator(`.wp-block-${slug}`).first(), notCase, {
    label: `the "${name}" block (".wp-block-${slug}")`,
    hint: 'Use the block\'s title as the editor shows it; a block of a plugin has its own class prefix, and the page must render it.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Assert the page renders a template part of a block theme: the header or the
 * footer. A template part renders as `<header class="wp-block-template-part">`
 * or `<footer class="wp-block-template-part">`.
 *
 * Example #1: Then I should see the header template part
 * Example #2: And we should see the footer template part
 * Example #3: Then I should not see the header template part
 * Example #4: And I should not see the footer template part
 * Example #5: But we should not see the header template part
 *
 */
Then(/^(I |we )*should( not)* see the (header|footer) template part$/, async function (pronounCase, notCase, area) {
  await expectRendered(this.page.locator(`${area}.wp-block-template-part`).first(), notCase, {
    label: `the ${area} template part (\`${area}.wp-block-template-part\`)`,
    hint: 'Template parts exist in block themes. A classic theme renders its header and footer from PHP files; assert with: Then "footer" should be visible.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// The page head
// ---------------------------------------------------------------------------

/**
 * Assert the page head advertises the REST API: the `<link rel="https://api.w.org/">`
 * that WordPress prints, which clients use to discover the API.
 *
 * Example #1: Then the page should advertise the REST API
 * Example #2: And the page should advertise the REST API
 * Example #3: But the page should advertise the REST API
 * Example #4: Then the page should not advertise the REST API
 * Example #5: But the page should not advertise the REST API
 *
 */
Then(/^the page should( not)* advertise the REST API$/, async function (notCase) {
  const link = this.page.locator('head link[rel="https://api.w.org/"]');
  const present = (await link.count()) > 0;
  if (present === Boolean(notCase)) {
    throw friendly({
      message: notCase ? 'Expected the page not to advertise the REST API.' : 'Expected the page to advertise the REST API.',
      hint: 'WordPress prints the link with rest_output_link_wp_head(); a hardening plugin may remove it, and a site may hide the API on purpose.',
    });
  }
});

/**
 * Assert the page head links to the site's RSS feed: the
 * `<link rel="alternate" type="application/rss+xml">` WordPress prints for
 * feed readers.
 *
 * Example #1: Then the page should link to the site feed
 * Example #2: And the page should link to the site feed
 * Example #3: But the page should link to the site feed
 * Example #4: Then the page should not link to the site feed
 * Example #5: But the page should not link to the site feed
 *
 */
Then(/^the page should( not)* link to the site feed$/, async function (notCase) {
  const link = this.page.locator('head link[rel="alternate"][type="application/rss+xml"]');
  const present = (await link.count()) > 0;
  if (present === Boolean(notCase)) {
    throw friendly({
      message: notCase ? 'Expected the page not to link to the site feed.' : 'Expected the page to link to the site feed.',
      hint: 'The theme must support automatic feed links (add_theme_support), and feeds must not be turned off.',
    });
  }
});
