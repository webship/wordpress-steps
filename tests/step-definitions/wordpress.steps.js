'use strict';

// WordPress-specific Cucumber step definitions for webship-js. These steps
// understand WordPress's default body classes, template hierarchy, and core
// markup (site title, primary navigation, footer, search form, wp-login.php,
// admin bar, comment form, widgets) so scenarios can assert against a
// WordPress site without hand-rolling CSS selectors in every feature file.
//
// The step phrases themselves stay CMS-agnostic (no "WordPress" in the
// Gherkin text) so feature files read as plain, direct assertions about the
// site under test — only the implementation behind them is WordPress-aware.
//
// Composes with webship-js's built-in steps (navigation.steps.js,
// assertion.steps.js, form.steps.js, response.steps.js, …) rather than
// duplicating them — use those directly in feature files wherever they
// already cover the need (e.g. "the response status code should be 404",
// "I should be on the homepage").

const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const axios = require('axios');
const { gotoUrl, waitForPageLoad } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Content discovery (WordPress REST API)
// ---------------------------------------------------------------------------
//
// Feature files should never hard-code a page slug, a post's publish date,
// or a category name — that content is specific to one fixture site and
// breaks the moment the suite runs against a real theme with real content.
// Instead, these helpers ask the site itself (via its always-on REST API)
// for one real page / post / category and drive the browser there, so the
// same scenario works unmodified against any WordPress site.

/**
 * Fetch a single WordPress REST API collection resource and return its
 * first entry, or throw a friendly error if the endpoint is unavailable or
 * the collection is empty.
 *
 * Uses the `?rest_route=` query-var form rather than the pretty `/wp-json/`
 * path: the pretty path only resolves when the site has a non-default
 * permalink structure (a rewrite rule registers it), so it silently 404s —
 * or even falls through to the homepage — on a genuinely default
 * `wp core install`, which uses "Plain" permalinks. `rest_route` is core's
 * own fallback and works identically regardless of permalink settings.
 */
async function discoverContent(baseUrl, route, params, describe) {
  const query = new URLSearchParams({ rest_route: route, ...params }).toString();
  const url = baseUrl.replace(/\/$/, '') + '/?' + query;
  const response = await axios.get(url, { validateStatus: () => true });
  assert.ok(
    response.status === 200,
    `Expected the REST API ("${route}") to respond 200 but got ${response.status} — is the REST API disabled?`
  );
  assert.ok(
    Array.isArray(response.data) && response.data.length > 0,
    `Expected the REST API to return at least one ${describe} but the collection was empty`
  );
  return response.data[0];
}

// ---------------------------------------------------------------------------
// Template-hierarchy assertions (WordPress body classes)
// ---------------------------------------------------------------------------

/**
 * Assert the current page is rendered by WordPress with the given
 * `body_class()` template-hierarchy flag (e.g. home, single, page, search,
 * archive, error404). WordPress writes these classes on `<body>` via
 * `body_class()` in every default and child theme.
 *
 * Example #1: Then I should be on a "home" page
 * Example #2: Then I should be on a "single" page
 * Example #3: Then I should be on a "page" page
 * Example #4: Then we should be on a "search" page
 * Example #5: And I should be on a "archive" page
 * Example #6: Then I should be on a "error404" page
 *
 */
Then(/^(I |we )*should be on a "([^"]*)?" page$/, async function (pronounCase, bodyClass) {
  const classAttr = await this.page.locator('body').getAttribute('class');
  assert.ok(
    classAttr && classAttr.split(/\s+/).includes(bodyClass),
    `Expected body class "${bodyClass}" but body class was: "${classAttr}" (at ${this.page.url()})`
  );
});

/**
 * Convenience wrapper for the WordPress front page / homepage template.
 * Equivalent to asserting the "home" body class WordPress adds via
 * `body_class()` on the site front page.
 *
 * Example #1: Then I should be on the front page
 * Example #2: And I should be on the homepage
 * Example #3: Then we should be on the front page
 * Example #4: And should be on the homepage
 * Example #5: Then I should be on the home page
 *
 */
Then(/^(I |we )*should be on the (?:front page|home ?page)$/, async function (pronounCase) {
  const classAttr = await this.page.locator('body').getAttribute('class');
  assert.ok(
    classAttr && classAttr.split(/\s+/).includes('home'),
    `Expected the front page ("home" body class) but body class was: "${classAttr}"`
  );
});

/**
 * Convenience wrapper for the WordPress 404 template. WordPress adds the
 * "error404" class (Twenty Seventeen and similar themes render it as
 * "error-404") when no query matches and `is_404()` is true.
 *
 * Example #1: Then I should be on the 404 page
 * Example #2: And I should be on the "not found" page
 * Example #3: Then we should be on the 404 page
 * Example #4: And should be on the 404 page
 * Example #5: Then I should land on the 404 page
 *
 */
Then(/^(I |we )*should (?:be on|land on) the (?:404|"not found") page$/, async function (pronounCase) {
  const classAttr = await this.page.locator('body').getAttribute('class');
  assert.ok(
    classAttr && /error-?404/.test(classAttr),
    `Expected the 404 template (error404 body class) but body class was: "${classAttr}"`
  );
});

// ---------------------------------------------------------------------------
// Core layout: site title, primary navigation, footer
// ---------------------------------------------------------------------------

/**
 * Assert the site title (or custom logo linking home) is visible. Matches
 * the ".site-title" element classic (`_s`-derived) themes render via
 * `bloginfo( 'name' )`, and the ".wp-block-site-title" element block themes
 * (Twenty Twenty-Four/Five, …) render via the Site Title block.
 *
 * Example #1: Then I should see the site title
 * Example #2: And I should see the site title "WP Test"
 * Example #3: Then we should see the site title
 * Example #4: And should see the site title "My Blog"
 * Example #5: Then I should see the site title "Sample Site"
 *
 */
Then(/^(I |we )*should see the site title(?: "([^"]*)?")?$/, async function (pronounCase, expectedTitle) {
  // Some themes wrap the title in a zero-height container (floated/absolute
  // children painting outside the box via `overflow: visible`) — Playwright's
  // strict visibility check reports that as hidden even though the text
  // renders on screen. Assert presence + non-empty text instead of strict
  // visibility so the step works across themes.
  const siteTitle = this.page.locator('.site-title, .wp-block-site-title').first();
  await assert.doesNotReject(
    () => siteTitle.waitFor({ state: 'attached', timeout: 10000 }),
    'Expected the site title (".site-title" or ".wp-block-site-title") to be present'
  );
  const text = (await siteTitle.textContent()) || '';
  assert.ok(text.trim().length > 0, 'Expected the site title to contain text but it was empty');
  if (expectedTitle) {
    assert.ok(
      text.includes(expectedTitle),
      `Expected site title to contain "${expectedTitle}" but found "${text.trim()}"`
    );
  }
});

/**
 * Assert the primary navigation menu is visible. Matches the
 * `role="navigation"` landmark classic themes render for the main menu
 * (commonly `#site-navigation` / `.main-navigation`), the ".wp-block-navigation"
 * element block themes render via the Navigation block, and falls back to
 * any bare `<nav>` element since the tag itself is an implicit landmark.
 *
 * Example #1: Then I should see the primary navigation menu
 * Example #2: And I should see the main navigation menu
 * Example #3: Then we should see the primary navigation menu
 * Example #4: And should see the main navigation menu
 * Example #5: Then I should see the navigation menu
 *
 */
Then(/^(I |we )*should see the (?:primary |main )?navigation menu$/, async function (pronounCase) {
  const nav = this.page
    .locator('nav[role="navigation"], .main-navigation, #site-navigation, nav.wp-block-navigation, nav')
    .first();
  await assert.doesNotReject(
    () => nav.waitFor({ state: 'visible', timeout: 10000 }),
    'Expected the primary navigation menu to be visible'
  );
});

/**
 * Assert the site footer is visible. Matches the `role="contentinfo"`
 * landmark classic themes render for the footer (commonly `#colophon` /
 * `.site-footer`), the footer template part block themes render
 * (`.wp-block-template-part`), and falls back to any bare `<footer>`
 * element since the tag itself is an implicit landmark.
 *
 * Example #1: Then I should see the footer
 * Example #2: And I should see the site footer
 * Example #3: Then we should see the footer
 * Example #4: And should see the site footer
 * Example #5: Then I should see the page footer
 *
 */
Then(/^(I |we )*should see the (?:site |page )?footer$/, async function (pronounCase) {
  const footer = this.page
    .locator('footer[role="contentinfo"], .site-footer, #colophon, footer.wp-block-template-part, footer')
    .first();
  await assert.doesNotReject(
    () => footer.waitFor({ state: 'visible', timeout: 10000 }),
    'Expected the site footer to be visible'
  );
});

/**
 * Assert a widget with the given title is visible in a sidebar or footer
 * widget area. Matches the `.widget` wrapper WordPress renders around every
 * registered sidebar widget, scoped by its visible `.widget-title`.
 *
 * Example #1: Then I should see the "Recent Posts" widget
 * Example #2: And I should see the "Recent Comments" widget
 * Example #3: Then we should see the "Search" widget
 * Example #4: And should see the "Archives" widget
 * Example #5: Then I should see the "Categories" widget
 *
 */
Then(/^(I |we )*should see the "([^"]*)?" widget$/, async function (pronounCase, widgetTitle) {
  const widget = this.page
    .locator('.widget', { has: this.page.locator('.widget-title', { hasText: widgetTitle }) })
    .first();
  await assert.doesNotReject(
    () => widget.waitFor({ state: 'visible', timeout: 10000 }),
    `Expected a widget titled "${widgetTitle}" to be visible`
  );
});

/**
 * Navigate to a real, existing "page" post type, discovered via the REST
 * API rather than a hard-coded slug — works against any site regardless of
 * what pages it actually has. Navigates via the `?page_id=` query var
 * rather than the REST `link` field: `link` renders a pretty permalink
 * whenever `permalink_structure` is set, but that's only guaranteed to
 * actually resolve if the site's rewrite rules are correctly wired up
 * server-side, which isn't something this suite controls or can assume.
 * `page_id` is core query-var routing WordPress always honors.
 *
 * Example #1: Given I am on a page
 * Example #2: Given we are on a page
 * Example #3: Given we are on a static page
 * Example #4: Given I am on a static page
 * Example #5: Given on a page
 *
 */
Given(/^(I am |we are )*on a (?:static )?page$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  const page = await discoverContent(this.launchUrl, '/wp/v2/pages', { per_page: 1, status: 'publish' }, 'published page');
  this.contentTitle = (page.title && page.title.rendered) || '';
  await gotoUrl(this.page, this.launchUrl.replace(/\/$/, '') + '/?page_id=' + page.id);
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Navigate to a real, existing "post" post type, discovered via the REST
 * API rather than a hard-coded slug and publish date — works against any
 * site regardless of what posts it actually has. Navigates via the `?p=`
 * query var rather than the REST `link` field, for the same
 * rewrite-rule-independence reason as the page step above.
 *
 * Example #1: Given I am on a post
 * Example #2: Given we are on a post
 * Example #3: Given we are on a blog post
 * Example #4: Given I am on a blog post
 * Example #5: Given on a post
 *
 */
Given(/^(I am |we are )*on a (?:blog )?post$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  const post = await discoverContent(this.launchUrl, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  this.contentTitle = (post.title && post.title.rendered) || '';
  await gotoUrl(this.page, this.launchUrl.replace(/\/$/, '') + '/?p=' + post.id);
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Navigate to a real, existing category archive, discovered via the REST
 * API rather than a hard-coded category slug — works against any site
 * regardless of what categories it actually has. Navigates via the `?cat=`
 * query var rather than the REST `link` field, for the same
 * rewrite-rule-independence reason as the page/post steps above.
 *
 * Example #1: Given I am on a category archive
 * Example #2: Given we are on a category archive
 * Example #3: Given I am on a taxonomy archive
 * Example #4: Given we are on a taxonomy archive
 * Example #5: Given I am on a category
 *
 */
Given(/^(I am |we are )*on a (?:category|taxonomy) archive$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  const category = await discoverContent(this.launchUrl, '/wp/v2/categories', { per_page: 1, hide_empty: 'true' }, 'non-empty category');
  this.contentTitle = category.name || '';
  await gotoUrl(this.page, this.launchUrl.replace(/\/$/, '') + '/?cat=' + category.id);
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Assert the page/post title discovered by a prior "on a page/post" step is
 * rendered somewhere on the page. Avoids hard-coding the title in the
 * feature file, since it is only known once discovered.
 *
 * Example #1: Then I should see the post title
 * Example #2: And I should see the page title
 * Example #3: Then we should see the post title
 * Example #4: And should see the page title
 * Example #5: Then I should see the content title
 *
 */
Then(/^(I |we )*should see the (?:post|page|content) title$/, async function (pronounCase) {
  assert.ok(
    this.contentTitle,
    'No page/post title captured — use "Given I am on a page/post" first'
  );
  const bodyText = (await this.page.locator('body').innerText()) || '';
  assert.ok(
    bodyText.includes(this.contentTitle),
    `Expected the page to display the content title "${this.contentTitle}" but it was not found in the page body`
  );
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Fill and submit the WordPress core search form (`.search-form`, field
 * name `s`) with the given term. Many themes — including the default block
 * theme on a plain `wp core install` — don't render a search field anywhere
 * by default (no sidebar/widget area, no Search block placed). WordPress
 * still serves `search.php` for any `?s=` query regardless, so fall back to
 * navigating there directly when no search field shows up in time.
 */
async function submitSearch(page, launchUrl, term, defaultTime) {
  const searchField = page.locator('input.search-field, input[name="s"]').first();
  const hasSearchField = await searchField
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (hasSearchField) {
    await searchField.fill(term);
    await searchField.press('Enter');
  } else {
    await gotoUrl(page, launchUrl.replace(/\/$/, '') + '/?s=' + encodeURIComponent(term));
  }
  await waitForPageLoad(page, defaultTime);
}

/**
 * Assert the current page is the search-results template (`search.php` —
 * `is_search()` true) and that it was generated for the given term, by
 * checking the URL's `s` query parameter.
 */
function assertSearchResults(page, classAttr, term) {
  assert.ok(
    classAttr && classAttr.split(/\s+/).includes('search'),
    `Expected the search-results template ("search" body class) but body class was: "${classAttr}"`
  );
  const currentUrl = page.url();
  const encoded = encodeURIComponent(term).replace(/%20/g, '+');
  assert.ok(
    currentUrl.includes(`s=${encoded}`) || currentUrl.includes(`s=${encodeURIComponent(term)}`),
    `Expected the search URL to contain the term "${term}" but URL was: ${currentUrl}`
  );
}

/**
 * Submit the core search form (`.search-form`, field name `s`) with the
 * given term. Works against any theme built on `get_search_form()`.
 *
 * Example #1: When I search the site for "hello world"
 * Example #2: When we search the site for "contact"
 * Example #3: When I search for "sample page"
 * Example #4: When we search for "test"
 * Example #5: When I search the site for "widgets"
 *
 */
When(/^(I |we )*search (?:the site )?for "([^"]*)?"$/, async function (pronounCase, term) {
  await submitSearch(this.page, this.launchUrl, term, this.minWaitTime.page || 3000);
});

/**
 * Assert the current page is the search-results template (`search.php` —
 * `is_search()` true) and that it was generated for the given term, by
 * checking the URL's `s` query parameter.
 *
 * Example #1: Then I should see search results for "hello world"
 * Example #2: And I should see search results for "contact"
 * Example #3: Then we should see search results for "sample page"
 * Example #4: And should see search results for "test"
 * Example #5: Then I should see search results for "widgets"
 *
 */
Then(/^(I |we )*should see search results for "([^"]*)?"$/, async function (pronounCase, term) {
  const classAttr = await this.page.locator('body').getAttribute('class');
  assertSearchResults(this.page, classAttr, term);
});

/**
 * Search for a term guaranteed to match, discovered from a real published
 * post's title via the REST API rather than a hard-coded term — works
 * against any site regardless of what content it actually has.
 *
 * Example #1: When I search the site for existing content
 * Example #2: When we search the site for existing content
 * Example #3: When I search for existing content
 * Example #4: When we search for existing content
 * Example #5: When I search the site for some existing content
 *
 */
When(/^(I |we )*search (?:the site )?for (?:some )?existing content$/, async function (pronounCase) {
  const post = await discoverContent(this.launchUrl, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  const title = (post.title && post.title.rendered) || '';
  const term = title.split(/\s+/).find((word) => word.length > 3) || title.split(/\s+/)[0] || title;
  assert.ok(term, 'Could not derive a search term from the discovered post title');
  this.searchTerm = term;
  await submitSearch(this.page, this.launchUrl, term, this.minWaitTime.page || 3000);
});

/**
 * Assert the current page is the search-results template and that it was
 * generated for the term captured by a prior "search for existing content"
 * step.
 *
 * Example #1: Then I should see search results for that content
 * Example #2: And I should see search results for that content
 * Example #3: Then we should see search results for that content
 * Example #4: And should see search results for that content
 * Example #5: Then I should see search results for the content
 *
 */
Then(/^(I |we )*should see search results for (?:that|the) content$/, async function (pronounCase) {
  assert.ok(
    this.searchTerm,
    'No search term captured — use "When I search the site for existing content" first'
  );
  const classAttr = await this.page.locator('body').getAttribute('class');
  assertSearchResults(this.page, classAttr, this.searchTerm);
});

// ---------------------------------------------------------------------------
// wp-login.php / authentication
// ---------------------------------------------------------------------------

/**
 * Open WordPress's core login screen at `/wp-login.php` under the launch URL.
 *
 * Example #1: Given I am on the login page
 * Example #2: Given we are on the login page
 * Example #3: Given I am on the sign in page
 * Example #4: Given we are on the sign-in page
 * Example #5: Given I am on the "wp-login" page
 *
 */
Given(/^(I am |we are )*on the (?:sign-?in|"wp-login"|login) page$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  await gotoUrl(this.page, this.launchUrl + '/wp-login.php');
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Assert the core login form is visible: username field, password field,
 * and submit button (`#loginform` / `#user_login` / `#user_pass` /
 * `#wp-submit` — present on every WordPress install, themed or not).
 *
 * Example #1: Then I should see the login form
 * Example #2: And I should see the sign in form
 * Example #3: Then we should see the login form
 * Example #4: And should see the login form
 * Example #5: Then I should see the sign-in form
 *
 */
Then(/^(I |we )*should see the (?:sign-?in|login) form$/, async function (pronounCase) {
  const form = this.page.locator('#loginform');
  await assert.doesNotReject(
    () => form.waitFor({ state: 'visible', timeout: 10000 }),
    'Expected the login form ("#loginform") to be visible'
  );
  await assert.doesNotReject(
    () => this.page.locator('#user_login').waitFor({ state: 'visible', timeout: 5000 }),
    'Expected the username field ("#user_login") to be visible'
  );
  await assert.doesNotReject(
    () => this.page.locator('#user_pass').waitFor({ state: 'visible', timeout: 5000 }),
    'Expected the password field ("#user_pass") to be visible'
  );
});

/**
 * Fill and submit the core login form with the given username and password
 * (`#user_login`, `#user_pass`, `#wp-submit`). Fills those fields directly
 * by their WordPress core CSS ids rather than via webship-js's
 * label/placeholder/name-oriented `fillField` helper: the login form has no
 * `<label for>` association and its `name` attributes ("log", "pwd") don't
 * match the ids, so `fillField` can never resolve them.
 *
 * Example #1: When I log in as "admin" with password "secret"
 * Example #2: When we log in as "editor" with password "p@ssw0rd"
 * Example #3: When I sign in as "admin" with password "secret"
 * Example #4: When we sign in as "reviewer" with password "hunter2"
 * Example #5: When I log in as "author" with password "letmein"
 *
 */
When(/^(I |we )*(?:log in|sign in) as "([^"]*)?" with password "([^"]*)?"$/, async function (pronounCase, username, password) {
  const defaultTime = this.minWaitTime.page || 3000;
  await this.page.locator('#user_login').fill(username);
  await this.page.locator('#user_pass').fill(password);
  await this.page.locator('#wp-submit').click();
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Assert the admin toolbar is visible, meaning the current session is
 * authenticated (`#wpadminbar` renders for any logged-in user with the
 * toolbar enabled, front-end or back-end).
 *
 * Example #1: Then I should see the admin bar
 * Example #2: And I should see the toolbar
 * Example #3: Then we should see the admin bar
 * Example #4: And should see the toolbar
 * Example #5: Then I should see the admin toolbar
 *
 */
Then(/^(I |we )*should see the (?:admin (?:bar|toolbar)|toolbar)$/, async function (pronounCase) {
  const adminBar = this.page.locator('#wpadminbar');
  await assert.doesNotReject(
    () => adminBar.waitFor({ state: 'visible', timeout: 10000 }),
    'Expected the admin bar ("#wpadminbar") to be visible — is the session authenticated?'
  );
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Assert the core comment form is visible on the current post/page.
 * `comment_form()` always outputs a `.comment-form` class, but the `id` is
 * filtered per-theme — core themes use `#commentform`, but others (e.g.
 * Astra, the active theme on this suite's own reference install) prefix it
 * (`#ast-commentform`). Match on the class, which is theme-independent.
 *
 * Example #1: Then I should see the comment form
 * Example #2: And I should see a comment form
 * Example #3: Then we should see the comment form
 * Example #4: And should see the comment form
 * Example #5: Then I should see the comments form
 *
 */
Then(/^(I |we )*should see (?:a|the) comments? form$/, async function (pronounCase) {
  const form = this.page.locator('#commentform, form.comment-form').first();
  await assert.doesNotReject(
    () => form.waitFor({ state: 'visible', timeout: 10000 }),
    'Expected the comment form ("#commentform" / ".comment-form") to be visible'
  );
});
