'use strict';

// WordPress-specific step definitions for webship-js.
//
// Step phrasing stays CMS-agnostic; only the implementation is WordPress-aware.
// Anything the core pack already covers (body classes, landmarks, status codes,
// element assertions) is used from webship-js directly rather than redefined —
// both packs share one namespace, so a duplicate phrasing is an ambiguous-step
// failure, not an override.

const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');
const axios = require('axios');
const { gotoUrl, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// None of the phrasings below match the core AfterStep auto-settle regex, so
// they settle themselves.
async function settle(world) {
  await smartSettle(world.page, (world.minWaitTime && world.minWaitTime.page) || 8000);
}

function siteRoot(launchUrl) {
  return String(launchUrl).replace(/\/$/, '');
}

// `presenceOnly` swaps visible/hidden for attached/detached — some themes wrap
// content in a zero-height container that Playwright reports as hidden even
// though it paints on screen.
async function expectRendered(locator, notCase, { label, hint, presenceOnly = false, timeout = 10000 }) {
  const state = presenceOnly
    ? (notCase ? 'detached' : 'attached')
    : (notCase ? 'hidden' : 'visible');
  try {
    await locator.waitFor({ state, timeout });
  } catch (err) {
    throw friendly({
      message: notCase
        ? `Expected ${label} to be gone from the page, but it is still there.`
        : `Expected ${label} to be on the page, but it was not found in time.`,
      cause: err,
      hint,
    });
  }
}

// Ask the site for real content so scenarios never hard-code a slug, a publish
// date or a category name. Uses `?rest_route=` rather than `/wp-json/`: the
// pretty path only resolves once a permalink structure registers its rewrite
// rule, so it 404s on a default install.
async function discoverContent(baseUrl, route, params, describe) {
  const query = new URLSearchParams({ rest_route: route, ...params }).toString();
  const url = siteRoot(baseUrl) + '/?' + query;
  let response;
  try {
    response = await axios.get(url, { validateStatus: () => true });
  } catch (err) {
    throw friendly({
      message: `Could not reach the content API at ${url}.`,
      cause: err,
      hint: 'Check that launchUrl points at the running site and that the host is reachable from the test runner.',
    });
  }
  if (response.status !== 200) {
    throw friendly({
      message: `The content API ("${route}") responded ${response.status} instead of 200.`,
      hint: 'The site may have the REST API disabled, or launchUrl may point at the wrong host.',
    });
  }
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw friendly({
      message: `The content API returned no ${describe}.`,
      hint: `Publish at least one ${describe} on the site under test, or drop the scenario that needs one.`,
    });
  }
  return response.data[0];
}

// Query-var routing (`?p=`, `?page_id=`, `?cat=`) is always honored; the REST
// `link` field renders a pretty permalink that only resolves when the site's
// rewrite rules are wired up server-side.
async function gotoQuery(world, query) {
  await gotoUrl(world.page, siteRoot(world.launchUrl) + '/?' + query);
  await world.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await settle(world);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Assert the site title is rendered, optionally matching its text. Covers
 * `.site-title` (classic themes) and `.wp-block-site-title` (block themes).
 *
 * Example #1: Then I should see the site title
 * Example #2: And we should see the site title "Sample Site"
 * Example #3: Then should see the site title
 * Example #4: Then I should not see the site title
 * Example #5: But we should not see the site title "Sample Site"
 *
 */
Then(/^(I |we )*should( not)* see the site title(?: "([^"]*)?")?$/, async function (pronounCase, notCase, expectedTitle) {
  const siteTitle = this.page.locator('.site-title, .wp-block-site-title').first();
  const hint = 'The theme may render the title as a logo image only, or use a non-core class — assert on the logo\'s alt text instead.';

  if (notCase && !expectedTitle) {
    await expectRendered(siteTitle, true, { label: 'the site title', hint, presenceOnly: true });
    return;
  }

  await expectRendered(siteTitle, false, { label: 'the site title', hint, presenceOnly: true });
  const text = ((await siteTitle.textContent()) || '').trim();

  if (!expectedTitle) {
    assert.ok(text.length > 0, 'Expected the site title to contain text but it was empty');
    return;
  }
  if (notCase) {
    assert.ok(!text.includes(expectedTitle), `Expected the site title NOT to contain "${expectedTitle}" but it was "${text}"`);
  } else {
    assert.ok(text.includes(expectedTitle), `Expected the site title to contain "${expectedTitle}" but found "${text}"`);
  }
});

// ---------------------------------------------------------------------------
// Content discovery
// ---------------------------------------------------------------------------

/**
 * Navigate to a real published page, discovered at runtime.
 *
 * Example #1: Given I am on a page
 * Example #2: Given we are on a static page
 * Example #3: And on a page
 * Example #4: Given we are on a page
 * Example #5: And I am on a static page
 *
 */
Given(/^(I am |we are )*on a (?:static )?page$/, async function (pronounCase) {
  const page = await discoverContent(this.launchUrl, '/wp/v2/pages', { per_page: 1, status: 'publish' }, 'published page');
  this.contentTitle = (page.title && page.title.rendered) || '';
  await gotoQuery(this, 'page_id=' + page.id);
});

/**
 * Navigate to a real published post, discovered at runtime.
 *
 * Example #1: Given I am on a post
 * Example #2: Given we are on a blog post
 * Example #3: And on a post
 * Example #4: Given we are on a post
 * Example #5: And I am on a blog post
 *
 */
Given(/^(I am |we are )*on a (?:blog )?post$/, async function (pronounCase) {
  const post = await discoverContent(this.launchUrl, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  this.contentTitle = (post.title && post.title.rendered) || '';
  await gotoQuery(this, 'p=' + post.id);
});

/**
 * Navigate to a real non-empty category archive, discovered at runtime.
 *
 * Example #1: Given I am on a category archive
 * Example #2: Given we are on a taxonomy archive
 * Example #3: And on a category archive
 * Example #4: Given we are on a category archive
 * Example #5: And I am on a taxonomy archive
 *
 */
Given(/^(I am |we are )*on a (?:category|taxonomy) archive$/, async function (pronounCase) {
  const category = await discoverContent(this.launchUrl, '/wp/v2/categories', { per_page: 1, hide_empty: 'true' }, 'non-empty category');
  this.contentTitle = category.name || '';
  await gotoQuery(this, 'cat=' + category.id);
});

/**
 * Assert the title discovered by a prior navigation step is on the page.
 *
 * Example #1: Then I should see the post title
 * Example #2: And we should see the page title
 * Example #3: Then should see the content title
 * Example #4: Then I should not see the post title
 * Example #5: But we should not see the content title
 *
 */
Then(/^(I |we )*should( not)* see the (?:post|page|content) title$/, async function (pronounCase, notCase) {
  if (!this.contentTitle) {
    throw friendly({
      message: 'No content title has been captured yet.',
      hint: 'Run "Given I am on a page", "Given I am on a post" or "Given I am on a category archive" earlier in the scenario.',
    });
  }
  const bodyText = (await this.page.locator('body').innerText()) || '';
  if (notCase) {
    assert.ok(
      !bodyText.includes(this.contentTitle),
      `Expected the page NOT to display the content title "${this.contentTitle}" but it was found in the page body`
    );
  } else {
    assert.ok(
      bodyText.includes(this.contentTitle),
      `Expected the page to display the content title "${this.contentTitle}" but it was not found in the page body`
    );
  }
});

/**
 * Assert the page lists post entries — the archive/search loop rendered rows.
 *
 * Classic themes wrap each entry in `<article>`; block themes render the Post
 * Template block as `<li class="wp-block-post …">`. Both carry the classes
 * `post_class()` emits, so `.post` catches what the tag names miss.
 *
 * Example #1: Then I should see post entries
 * Example #2: And we should see post entries
 * Example #3: Then should see post entries
 * Example #4: Then I should not see any post entries
 * Example #5: But we should not see any post entries
 *
 */
Then(/^(I |we )*should( not)* see (?:any )?post entries$/, async function (pronounCase, notCase) {
  const entries = this.page.locator('article, .wp-block-post, .post');
  const count = await entries.count();
  if (notCase) {
    assert.strictEqual(count, 0, `Expected no post entries on the page but found ${count}.`);
    return;
  }
  if (count === 0) {
    throw friendly({
      message: 'Expected the page to list at least one post entry, but found none.',
      hint: 'The loop rendered nothing — check the category or search actually has published posts, or that the theme marks entries with post_class().',
    });
  }
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// Many themes render no search field at all by default. WordPress still serves
// search.php for any `?s=` query, so fall back to navigating there.
async function submitSearch(world, term) {
  const searchField = world.page.locator('input.search-field, input[name="s"]').first();
  const hasSearchField = await searchField
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (hasSearchField) {
    await searchField.fill(term);
    await searchField.press('Enter');
  } else {
    await gotoUrl(world.page, siteRoot(world.launchUrl) + '/?s=' + encodeURIComponent(term));
  }
  await settle(world);
}

/**
 * Search the site for a term.
 *
 * Example #1: When I search the site for "hello world"
 * Example #2: When we search for "contact"
 * Example #3: And search the site for "example"
 * Example #4: When we search the site for "Sample title"
 * Example #5: And I search for "widgets"
 *
 */
When(/^(I |we )*search (?:the site )?for "([^"]*)?"$/, async function (pronounCase, term) {
  this.searchTerm = term;
  await submitSearch(this, term);
});

/**
 * Search for a term taken from a real published post title, so the search is
 * guaranteed to match without naming content in the feature file.
 *
 * Example #1: When I search the site for existing content
 * Example #2: When we search for existing content
 * Example #3: And search for some existing content
 * Example #4: When we search the site for some existing content
 * Example #5: And I search for existing content
 *
 */
When(/^(I |we )*search (?:the site )?for (?:some )?existing content$/, async function (pronounCase) {
  const post = await discoverContent(this.launchUrl, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  const title = (post.title && post.title.rendered) || '';
  const words = title.split(/\s+/).filter(Boolean);
  const term = words.find((word) => word.length > 3) || words[0] || title;
  if (!term) {
    throw friendly({
      message: 'Could not derive a search term from the most recent published post.',
      hint: 'The post title is empty — publish a post with a title, or use "I search the site for \\"term\\"" instead.',
    });
  }
  this.searchTerm = term;
  await submitSearch(this, term);
});

/**
 * Assert the search-results template rendered for the expected term — named
 * inline, or taken from whatever a prior search step stashed.
 *
 * Example #1: Then I should see search results for "hello world"
 * Example #2: And we should see search results for that content
 * Example #3: Then should see search results for the content
 * Example #4: And should see search results for "contact"
 * Example #5: Then we should see search results for "example"
 *
 */
Then(/^(I |we )*should see search results for (?:"([^"]*)?"|(?:that|the) content)$/, async function (pronounCase, term) {
  // An unmatched alternation group arrives as null, not undefined.
  const expected = term ?? this.searchTerm;
  if (expected === undefined || expected === null) {
    throw friendly({
      message: 'No search term has been captured yet.',
      hint: 'Run a search step first, or name the term inline: Then I should see search results for "example".',
    });
  }
  const classAttr = await this.page.locator('body').getAttribute('class');
  assert.ok(
    (classAttr || '').split(/\s+/).includes('search'),
    `Expected the search-results template ("search" body class) but the body class was: "${classAttr}"`
  );
  // A space reaches the URL as `+` or `%20` depending on whether the form or a
  // direct navigation submitted it.
  const currentUrl = this.page.url();
  const encoded = encodeURIComponent(expected);
  assert.ok(
    currentUrl.includes(`s=${encoded.replace(/%20/g, '+')}`) || currentUrl.includes(`s=${encoded}`),
    `Expected the search URL to carry the term "${expected}" but the URL was: ${currentUrl}`
  );
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

// Fills by core CSS id rather than webship-js's `fillField`: the login form has
// no `<label for>` association and its name attributes ("log", "pwd") don't
// match the ids, so label/placeholder/name resolution can never find them.
async function submitLogin(world, username, password) {
  try {
    await world.page.locator('#user_login').fill(username);
    await world.page.locator('#user_pass').fill(password);
    // Submit from inside the page rather than with a pointer click: a fixed
    // overlay (a cookie banner, a chat widget) can sit on top of the button and
    // make a real click wait out its actionability timeout, while the form's
    // own submit cannot be covered. Wait for the navigation it starts.
    await Promise.all([
      world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      world.page.evaluate(() => {
        const submit = document.querySelector('#wp-submit');
        if (submit) { submit.click(); return; }
        const form = document.querySelector('#loginform') || document.forms[0];
        if (form) form.submit();
      }),
    ]);
  } catch (err) {
    throw friendly({
      message: `Could not submit the login form as "${username}".`,
      cause: err,
      hint: 'Open the login page first, and check the site is not fronted by a plugin that replaces the core login screen.',
    });
  }
  await settle(world);
}

/**
 * Open the core login screen.
 *
 * Example #1: Given I am on the login page
 * Example #2: Given we are on the sign in page
 * Example #3: And on the login page
 * Example #4: Given we are on the sign-in page
 * Example #5: And I am on the signin page
 *
 */
Given(/^(I am |we are )*on the (?:sign[- ]?in|login) page$/, async function (pronounCase) {
  await gotoUrl(this.page, siteRoot(this.launchUrl) + '/wp-login.php');
  await this.page.waitForSelector('body', { state: 'attached', timeout: 10000 });
  await settle(this);
});

/**
 * Assert the login form, username field and password field are rendered. Each
 * is checked separately so a failure names which one is missing.
 *
 * Example #1: Then I should see the login form
 * Example #2: And we should see the sign in form
 * Example #3: Then should see the sign-in form
 * Example #4: Then I should not see the login form
 * Example #5: But we should not see the sign in form
 *
 */
Then(/^(I |we )*should( not)* see the (?:sign[- ]?in|login) form$/, async function (pronounCase, notCase) {
  const hint = 'A security plugin may have moved or replaced the core login screen at /wp-login.php.';
  await expectRendered(this.page.locator('#loginform'), notCase, { label: 'the login form ("#loginform")', hint });
  if (notCase) return;
  await expectRendered(this.page.locator('#user_login'), false, { label: 'the username field ("#user_login")', hint, timeout: 5000 });
  await expectRendered(this.page.locator('#user_pass'), false, { label: 'the password field ("#user_pass")', hint, timeout: 5000 });
});

/**
 * Log in with explicit credentials, for scenarios where the credentials are
 * the subject. Requires the login screen to be open already.
 *
 * Example #1: When I log in as "admin" with password "secret"
 * Example #2: When we sign in as "editor" with password "p@ssw0rd"
 * Example #3: And log in as "author" with password "letmein"
 * Example #4: And we log in as "reviewer" with password "hunter2"
 * Example #5: When I sign in as "admin" with password "wrong-password"
 *
 */
When(/^(I |we )*(?:log in|sign in) as "([^"]*)?" with password "([^"]*)?"$/, async function (pronounCase, username, password) {
  await submitLogin(this, username, password);
});

/**
 * Sign in as a user configured in `worldParameters.users`, so passwords stay
 * out of feature files. Opens the login screen first.
 *
 * Example #1: Given I am a logged in user with the username "admin"
 * Example #2: Given we are a logged in user with username "editor"
 * Example #3: Given I am a logged in user with "author"
 * Example #4: And a logged in user with the username "admin"
 * Example #5: Given I am a logged in user with the username "admin" user
 *
 */
Given(/^(I am |we are )*a logged in user with( the)*( username)* "([^"]*)?"( user)*$/, async function (pronounCase, theCase, usernameCase, userKey, userCase) {
  const users = (this.parameters && this.parameters.users) || {};
  const entry = users[userKey];
  if (!entry) {
    throw friendly({
      message: `User "${userKey}" is not configured.`,
      hint: `Add it to worldParameters.users in cucumber.js. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
    });
  }
  const username = entry.username || userKey;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `User "${userKey}" has no password configured.`,
      hint: 'Set worldParameters.users.' + userKey + '.password in cucumber.js, ideally from an environment variable.',
    });
  }
  await gotoUrl(this.page, siteRoot(this.launchUrl) + '/wp-login.php');
  await this.page.waitForSelector('#loginform', { state: 'visible', timeout: 10000 });
  await submitLogin(this, username, password);
});

/**
 * End any authenticated session and land on the login screen as a visitor:
 * cookies and web storage are cleared, the login page is opened and the core
 * login form is confirmed. Use it at the start of a scenario that must run
 * anonymously after an earlier one logged in, or mid-scenario to check what a
 * visitor gets at a path an authenticated user just saw.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given not logged in
 * Example #5: But I am not logged in
 *
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.context.clearCookies();
  try {
    await this.page.evaluate(() => {
      try { localStorage.clear(); } catch { /* storage may be unavailable */ }
      try { sessionStorage.clear(); } catch { /* storage may be unavailable */ }
    });
  } catch { /* the page may not be on a real URL yet */ }
  await gotoUrl(this.page, siteRoot(this.launchUrl) + '/wp-login.php');
  await this.page.waitForSelector('#loginform', { state: 'visible', timeout: 10000 });
});

/**
 * Assert the admin toolbar is rendered — the cheapest signal that the session
 * is (or is not) authenticated.
 *
 * Example #1: Then I should see the admin bar
 * Example #2: And we should see the admin toolbar
 * Example #3: Then should see the toolbar
 * Example #4: Then I should not see the admin bar
 * Example #5: But we should not see the toolbar
 *
 */
Then(/^(I |we )*should( not)* see the (?:admin (?:bar|toolbar)|toolbar)$/, async function (pronounCase, notCase) {
  await expectRendered(this.page.locator('#wpadminbar'), notCase, {
    label: 'the admin toolbar ("#wpadminbar")',
    hint: 'The toolbar only renders for an authenticated session that has not disabled it in the user profile.',
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Assert the comment form is rendered. Matches on the `.comment-form` class,
 * which is theme-independent — the id is filtered per theme.
 *
 * Example #1: Then I should see the comment form
 * Example #2: And we should see a comment form
 * Example #3: Then should see the comments form
 * Example #4: Then I should not see a comment form
 * Example #5: But we should not see the comment form
 *
 */
Then(/^(I |we )*should( not)* see (?:a|the) comments? form$/, async function (pronounCase, notCase) {
  const form = this.page.locator('#commentform, form.comment-form').first();
  await expectRendered(form, notCase, {
    label: 'the comment form',
    hint: 'Comments may be closed on this entry, or disabled site-wide in the discussion settings.',
  });
});
