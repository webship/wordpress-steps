'use strict';

// WordPress step definitions for webship-js: the public site.
//
// Step phrasing stays CMS-agnostic; only the implementation is WordPress-aware.
// Anything webship-js already covers (body classes, landmarks, status codes,
// element assertions) is used from webship-js directly rather than redefined:
// all packs share one namespace, so a duplicate phrasing is an ambiguous-step
// failure, not an override.
//
// This pack's step files, by area:
//   wordpress.steps.js           the public site: layout, content, search
//   wordpress-session.steps.js   login, logout, accounts and roles
//   wordpress-helpers.js         shared helpers, no steps

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  gotoQuery,
  expectText,
  expectRendered,
  discoverContent,
  renderedText,
} = require('./wordpress-helpers');

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
  const hint = 'The theme may render the title as a logo image only, or use a non-core class. Assert on the logo\'s alt text instead.';

  if (notCase && !expectedTitle) {
    await expectRendered(siteTitle, true, { label: 'the site title', hint, presenceOnly: true });
    return;
  }

  await expectRendered(siteTitle, false, { label: 'the site title', hint, presenceOnly: true });

  if (!expectedTitle) {
    // Any non-blank text will do: wait for the element to carry some.
    try {
      await siteTitle.filter({ hasText: /\S/ }).waitFor({ state: 'attached', timeout: budget(this) });
    } catch (err) {
      throw friendly({
        message: 'Expected the site title to contain text, but it is empty.',
        cause: err,
        hint: 'Set a site title under Settings > General, or assert on the logo image when the theme shows only a logo.',
      });
    }
    return;
  }
  await expectText(siteTitle, expectedTitle, notCase, {
    label: 'the site title',
    hint: 'The text is matched as a case-sensitive substring of the rendered site title; check Settings > General.',
    timeout: budget(this),
  });
});

/**
 * Assert the admin toolbar is rendered. It is the cheapest signal that the
 * session is, or is not, authenticated on the public site.
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
    hint: 'The toolbar only renders for an authenticated session that has not turned it off in the user profile.',
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Assert the comment form is rendered. It matches `#commentform` and the
 * `.comment-form` class, which the core comment form carries in classic and
 * block themes alike.
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
    hint: 'Comments may be closed on this entry, or turned off site-wide in Settings > Discussion.',
  });
});

// ---------------------------------------------------------------------------
// Content discovery
// ---------------------------------------------------------------------------

/**
 * Open a real published page, discovered through the REST API at run time.
 *
 * Example #1: Given I am on a page
 * Example #2: Given we are on a static page
 * Example #3: And on a page
 * Example #4: Given we are on a page
 * Example #5: And I am on a static page
 *
 */
Given(/^(I am |we are )*on a (?:static )?page$/, async function (pronounCase) {
  const page = await discoverContent(this, '/wp/v2/pages', { per_page: 1, status: 'publish' }, 'published page');
  this.contentTitle = renderedText(page.title && page.title.rendered);
  await gotoQuery(this, 'page_id=' + page.id);
});

/**
 * Open a real published post, discovered through the REST API at run time.
 *
 * Example #1: Given I am on a post
 * Example #2: Given we are on a blog post
 * Example #3: And on a post
 * Example #4: Given we are on a post
 * Example #5: And I am on a blog post
 *
 */
Given(/^(I am |we are )*on a (?:blog )?post$/, async function (pronounCase) {
  const post = await discoverContent(this, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  this.contentTitle = renderedText(post.title && post.title.rendered);
  await gotoQuery(this, 'p=' + post.id);
});

/**
 * Open a real non-empty category archive, discovered through the REST API at
 * run time.
 *
 * Example #1: Given I am on a category archive
 * Example #2: Given we are on a taxonomy archive
 * Example #3: And on a category archive
 * Example #4: Given we are on a category archive
 * Example #5: And I am on a taxonomy archive
 *
 */
Given(/^(I am |we are )*on a (?:category|taxonomy) archive$/, async function (pronounCase) {
  const category = await discoverContent(this, '/wp/v2/categories', { per_page: 1, hide_empty: 'true' }, 'non-empty category');
  this.contentTitle = renderedText(category.name);
  await gotoQuery(this, 'cat=' + category.id);
});

/**
 * Assert the title found by an earlier "on a page", "on a post" or "on a
 * category archive" step is in a heading of the page. The headings are the
 * level-one heading and the theme's title elements, so a title that only
 * appears in a "more posts" list does not count.
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
  await expectText(this.page.locator('h1, h1.wp-block-post-title, .entry-title').filter({ visible: true }), this.contentTitle, notCase, {
    label: `the page headings (looking for the content title "${this.contentTitle}")`,
    hint: 'The title comes from the REST API; a theme that hides the title on this template, or rewrites it, fails this step.',
    timeout: budget(this),
  });
});

/**
 * Assert the page lists post entries: the archive or search loop rendered
 * rows. Classic themes wrap each entry in `<article>`; block themes render the
 * Post Template block as `<li class="wp-block-post ...">`. Both carry the
 * classes `post_class()` emits, so `.post` catches what the tag names miss.
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
  await expectRendered(entries.first(), notCase, {
    label: 'a post entry (an "article", ".wp-block-post" or ".post" element)',
    hint: notCase
      ? 'The loop rendered entries; check the archive or search really has no published posts. Block themes also list "more posts" under an empty result.'
      : 'The loop rendered nothing; check the category or search has published posts, or that the theme marks entries with post_class().',
    presenceOnly: true,
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

// The search form of the page. Core renders `form.search-form` (classic) and
// the Search block `form.wp-block-search` (block themes); `role="search"` is
// the landmark both carry.
const SEARCH_FORM = 'form[role="search"], form.search-form, form.wp-block-search';

// Open the site's own search results URL for a term. WordPress serves its
// search template for any `?s=` query, whether or not the theme shows a form.
async function openSearchResults(world, term) {
  world.searchTerm = term;
  await navigate(world, '/?s=' + encodeURIComponent(term));
}

// A search term from the title of a real published post, so the search is
// guaranteed to match without naming content in the feature file.
async function existingContentTerm(world) {
  const post = await discoverContent(world, '/wp/v2/posts', { per_page: 1, status: 'publish' }, 'published post');
  const words = renderedText(post.title && post.title.rendered).split(/\s+/).filter(Boolean);
  const term = words.find((word) => /^[\p{L}\p{N}]{4,}$/u.test(word)) || words[0];
  if (!term) {
    throw friendly({
      message: 'Could not derive a search term from the most recent published post.',
      hint: 'The post title is empty. Publish a post with a title, or use: When I search the site for "term".',
    });
  }
  return term;
}

/**
 * Open the search results for a term, through the site's own search URL
 * (`/?s=term`). It tests the results template and the search itself on any
 * theme, with or without a search form on the page. To test the form, use
 * "I use the search form to search for".
 *
 * Example #1: When I search the site for "hello world"
 * Example #2: When we search for "contact"
 * Example #3: And search the site for "example"
 * Example #4: When we search the site for "Sample title"
 * Example #5: And I search for "widgets"
 *
 */
When(/^(I |we )*search (?:the site )?for "([^"]*)?"$/, async function (pronounCase, term) {
  await openSearchResults(this, term);
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
  await openSearchResults(this, await existingContentTerm(this));
});

/**
 * Assert the page offers a search form: the Search block on a block theme,
 * `searchform` on a classic theme.
 *
 * Example #1: Then I should see the search form
 * Example #2: And we should see a search form
 * Example #3: Then should see the search form
 * Example #4: Then I should not see the search form
 * Example #5: But we should not see a search form
 *
 */
Then(/^(I |we )*should( not)* see (?:a|the) search form$/, async function (pronounCase, notCase) {
  await expectRendered(this.page.locator(SEARCH_FORM).first(), notCase, {
    label: 'a search form (a "form[role=search]", ".search-form" or ".wp-block-search" element)',
    hint: 'Many block themes show the search form only on the search results and 404 templates. Open one of those, or add the Search block to the template.',
    timeout: budget(this),
  });
});

/**
 * Search through the search form on the current page: the term is typed in
 * the form's field and the form is submitted. It fails when the page has no
 * search form.
 *
 * Example #1: When I use the search form to search for "hello"
 * Example #2: When we use the search form to search for "contact"
 * Example #3: And use the search form to search for "example"
 * Example #4: When I use the search form to search for "Sample title"
 * Example #5: And we use the search form to search for "widgets"
 *
 */
When(/^(I |we )*use the search form to search for "([^"]*)?"$/, async function (pronounCase, term) {
  const form = this.page.locator(SEARCH_FORM).filter({ visible: true }).first();
  await expectRendered(form, false, {
    label: 'a search form',
    hint: 'Open a page that shows one (the search results and 404 pages of a block theme do), or use: When I search the site for "term".',
    timeout: budget(this),
  });
  this.searchTerm = term;
  const field = form.locator('input[name="s"]').first();
  await field.fill(term);
  const before = this.page.url();
  await Promise.all([
    this.page.waitForURL((url) => String(url) !== before && url.searchParams.get('s') === term, { timeout: 15000 }).catch(() => {}),
    field.press('Enter'),
  ]);
  await settle(this);
});

/**
 * Assert the page is the search results template with at least one match for
 * the term, named inline or taken from the search before it. The body class is
 * `search-results`: block themes also list "more posts" under an empty result,
 * so counting entries could not tell a match from none.
 *
 * Example #1: Then I should see search results for "hello world"
 * Example #2: And we should see search results for that content
 * Example #3: Then should see search results for the content
 * Example #4: And should see search results for "contact"
 * Example #5: Then we should see search results for "example"
 *
 */
Then(/^(I |we )*should see search results for (?:"([^"]*)?"|(?:that|the) content)$/, async function (pronounCase, term) {
  await assertSearchPage(this, term, false);
});

/**
 * Assert the search found nothing for the term: the results template with
 * the `search-no-results` body class.
 *
 * Example #1: Then I should see no search results for "qzxjvwk"
 * Example #2: And we should see no search results for that content
 * Example #3: Then should see no search results for the content
 * Example #4: And should see no search results for "nothing like this"
 * Example #5: Then we should see no search results for "zzz"
 *
 */
Then(/^(I |we )*should see no search results for (?:"([^"]*)?"|(?:that|the) content)$/, async function (pronounCase, term) {
  await assertSearchPage(this, term, true);
});

async function assertSearchPage(world, term, empty) {
  // An unmatched alternation group arrives as null, not undefined.
  const expected = term ?? world.searchTerm;
  if (expected === undefined || expected === null) {
    throw friendly({
      message: 'No search term has been captured yet.',
      hint: 'Run a search step first, or name the term inline: Then I should see search results for "example".',
    });
  }
  const wanted = empty ? 'search-no-results' : 'search-results';
  try {
    await world.page.locator('body.' + wanted).waitFor({ state: 'attached', timeout: budget(world) });
  } catch (err) {
    const classAttr = await world.page.locator('body').getAttribute('class').catch(() => '');
    throw friendly({
      message: empty
        ? `Expected the search for "${expected}" to find nothing (the "search-no-results" body class).`
        : `Expected the search for "${expected}" to find something (the "search-results" body class).`,
      cause: `the body class was "${classAttr}"`,
      hint: 'The theme must call body_class(). A search form that posts elsewhere, or a redirect, lands on another template.',
    });
  }
  // A space reaches the URL as `+` or `%20`, depending on whether the form or
  // a direct navigation submitted it.
  const encoded = encodeURIComponent(expected);
  const carriesTerm = (url) => url.includes(`s=${encoded.replace(/%20/g, '+')}`) || url.includes(`s=${encoded}`);
  try {
    await world.page.waitForURL((url) => carriesTerm(String(url)), { timeout: budget(world) });
  } catch (err) {
    throw friendly({
      message: `Expected the search URL to carry the term "${expected}".`,
      cause: `the URL was ${world.page.url()}`,
      hint: 'Run a search step first, or name the same term the search used.',
    });
  }
}

/**
 * Assert a search result lists an entry whose title contains the text.
 *
 * Example #1: Then the search results should include "Hello world!"
 * Example #2: And the search results should include "Sample Page"
 * Example #3: Then the search results should not include "Privacy Policy"
 * Example #4: But the search results should not include "Draft title"
 * Example #5: And the search results should include "News"
 *
 */
Then(/^the search results should( not)* include "([^"]*)"$/, async function (notCase, title) {
  const entries = this.page.locator('main article, main .wp-block-post, main .post, #main article, #content article').filter({ has: this.page.locator('h1, h2, h3, .entry-title, .wp-block-post-title') });
  await expectText(entries, title, notCase, {
    label: 'the search result entries',
    hint: 'A published post or page whose title contains the text must exist, and the search must reach it. Drafts and private content are not in public search.',
    timeout: budget(this),
  });
});
