'use strict';

// Shared helpers for the WordPress step files.
//
// Not a step file: it registers no step definitions and no hooks. It holds the
// plumbing the step files share: optional-argument handling, presence and text
// assertions, the users registry, the login submit, the administration screens
// by name, the REST API client (with the nonce a logged-in session needs) and
// real-content discovery.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`,
// `friendly`) so the steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');

// Kept below webship-js's 45 second step timeout, so a locator that never
// settles fails through the authored message, not as "function timed out".
const WAIT_TIMEOUT = 30000;

/**
 * Whether an optional step argument was supplied. A regex group that did not
 * take part in the match reaches the step as `undefined` (or `null` once a
 * transform has run), so every optional argument is tested through this.
 *
 * @param {*} value
 * @returns {boolean}
 */
function supplied(value) {
  return value !== undefined && value !== null;
}

/**
 * The per-page wait budget from `worldParameters.minWaitTime.page`.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return (world && world.minWaitTime && world.minWaitTime.page) || 3000;
}

/**
 * Let the page settle after an action. None of the pack's phrasings match the
 * webship-js after-step auto-settle, so each step settles itself.
 *
 * @param {object} world
 * @returns {Promise<void>}
 */
async function settle(world) {
  await smartSettle(world.page, budget(world));
}

/**
 * The site root without a trailing slash.
 *
 * @param {string} launchUrl
 * @returns {string}
 */
function siteRoot(launchUrl) {
  return String(launchUrl).replace(/\/+$/, '');
}

/**
 * Join the launch URL and a path with exactly one slash. Absolute URLs pass
 * through unchanged.
 *
 * @param {string} launchUrl
 * @param {string} url
 * @returns {string}
 */
function joinUrl(launchUrl, url) {
  if (!url) return siteRoot(launchUrl);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(launchUrl) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a path on the site under test and wait for the page to settle.
 *
 * @param {object} world
 * @param {string} url - A path such as `/wp-login.php`, or an absolute URL.
 * @returns {Promise<import('playwright').Response|null>}
 */
async function navigate(world, url) {
  const response = await gotoUrl(world.page, joinUrl(world.launchUrl, url));
  await world.page.waitForSelector('body', { state: 'attached', timeout: WAIT_TIMEOUT });
  await settle(world);
  return response || null;
}

/**
 * A whitespace-tolerant, case-sensitive regex for "contains this text", so a
 * Playwright `hasText` filter can be the wait.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function textPattern(text) {
  return new RegExp(String(text).trim().split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'));
}

/**
 * Assert a locator's text contains (or, with `notCase`, does not contain) the
 * expected text. The assertion is the wait: the locator is narrowed to "has
 * this text" and Playwright polls for that narrowed set to exist or be gone.
 *
 * @param {import('playwright').Locator} locator
 * @param {string} expectedText
 * @param {*} notCase
 * @param {{label: string, hint?: string, timeout?: number}} options
 * @returns {Promise<void>}
 */
async function expectText(locator, expectedText, notCase, { label, hint, timeout = 10000 }) {
  const withText = locator.filter({ hasText: textPattern(expectedText) });
  try {
    await withText.first().waitFor({ state: notCase ? 'detached' : 'attached', timeout });
  } catch (err) {
    const text = ((await locator.allTextContents().catch(() => [])).join(' | ')).replace(/\s+/g, ' ').trim();
    throw friendly({
      message: notCase
        ? `Expected ${label} not to contain "${expectedText}".`
        : `Expected ${label} to contain "${expectedText}".`,
      cause: `it reads "${text.slice(0, 200)}"`,
      hint: hint || 'Text is matched as a case-sensitive substring, with whitespace collapsed.',
    });
  }
}

/**
 * Assert an element is rendered, or with `notCase` gone. `presenceOnly` swaps
 * visible/hidden for attached/detached: some themes wrap content in a
 * zero-height container that Playwright reports as hidden although it paints.
 *
 * @param {import('playwright').Locator} locator
 * @param {*} notCase
 * @param {{label: string, hint?: string, presenceOnly?: boolean, timeout?: number}} options
 * @returns {Promise<void>}
 */
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
      cause: err && err.name === 'TimeoutError' ? undefined : err,
      hint,
    });
  }
}

// ---------------------------------------------------------------------------
// Users registry
// ---------------------------------------------------------------------------

/**
 * Look up an account by its handle in `worldParameters.users`. The registry
 * maps a handle a feature file can read ("admin", "editor", "subscriber") to
 * the real account: `{ username, password }`. A handle with no `username`
 * falls back to the handle itself as the account name. Accounts are
 * configuration: a feature never creates or deletes one.
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `User "${handle}" is not configured.`,
      hint: `Add it to worldParameters.users in cucumber.js. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
    });
  }
  const account = typeof entry === 'string' ? { password: entry } : entry;
  if (!account.password) {
    throw friendly({
      message: `User "${handle}" has no password configured.`,
      hint: `Set worldParameters.users.${handle}.password in cucumber.js, ideally from an environment variable.`,
    });
  }
  return { username: account.username || handle, password: account.password };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Open the core login screen and wait for its form.
 *
 * @param {object} world
 * @returns {Promise<void>}
 */
async function openLogin(world) {
  await navigate(world, '/wp-login.php');
  try {
    await world.page.locator('#loginform').waitFor({ state: 'visible', timeout: 10000 });
  } catch (err) {
    throw friendly({
      message: 'The login form ("#loginform") did not appear at /wp-login.php.',
      cause: err,
      hint: 'A security plugin may have moved the login screen, or launchUrl may point at the wrong site.',
    });
  }
}

/**
 * Fill and submit the login form, then report the outcome without judging it.
 *
 * It fills by the core ids because the form has no `<label for>` association
 * and its names ("log", "pwd") do not match the ids. It submits from inside
 * the page rather than with a pointer click: a fixed overlay (a cookie banner,
 * a chat widget) can sit on top of the button and make a real click wait out
 * its actionability timeout, while the form's own submit cannot be covered.
 *
 * @param {object} world
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ok: boolean, error: string}>} `error` is the notice text
 *   the login screen showed, when it showed one.
 */
async function submitLogin(world, username, password) {
  const page = world.page;
  try {
    await page.locator('#user_login').fill(username);
    await page.locator('#user_pass').fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
      page.evaluate(() => {
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
      hint: 'Open the login page first, and check that no plugin replaces the core login screen.',
    });
  }
  await settle(world);
  const notice = page.locator('#login_error');
  const error = (await notice.count()) ? ((await notice.first().textContent()) || '').replace(/\s+/g, ' ').trim() : '';
  const stillOnLogin = /\/wp-login\.php/.test(new URL(page.url()).pathname);
  return { ok: !error && !stillOnLogin, error };
}

/**
 * Log in as a configured handle. Fails with the login screen's own message
 * when WordPress refuses the credentials, so a wrong password is reported
 * where it happens and not as a puzzling failure several steps later.
 *
 * @param {object} world
 * @param {string} handle
 * @returns {Promise<{username: string}>}
 */
async function loginAs(world, handle) {
  const account = resolveUser(world, handle);
  await openLogin(world);
  const outcome = await submitLogin(world, account.username, account.password);
  if (!outcome.ok) {
    throw friendly({
      message: `Could not log in as "${handle}" (account "${account.username}").`,
      cause: outcome.error || `the browser stayed on ${world.page.url()}`,
      hint: 'Check worldParameters.users in cucumber.js (or the WP_*_USER and WP_*_PASSWORD variables) against the site, and that the account exists there.',
    });
  }
  return account;
}

/**
 * Whether the browser session is authenticated, asked of the server: the
 * `rest-nonce` Ajax action answers only a logged-in session. A stale cookie
 * does not count, and a page on the front end needs no admin bar to answer.
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function isLoggedIn(world) {
  const response = await world.context.request.get(joinUrl(world.launchUrl, '/wp-admin/admin-ajax.php?action=rest-nonce'), { failOnStatusCode: false });
  return response.status() === 200 && /^[a-f0-9]{6,}$/i.test((await response.text()).trim());
}

// ---------------------------------------------------------------------------
// Administration screens
// ---------------------------------------------------------------------------

// Screen names a feature can use, to the path WordPress serves them at. A name
// is matched case-insensitively. Block-theme screens (Navigation, Patterns)
// and classic-theme screens (Menus, Widgets) are listed together; the site's
// theme decides which of them exist.
const ADMIN_SCREENS = {
  'dashboard': '/wp-admin/',
  'updates': '/wp-admin/update-core.php',
  'posts': '/wp-admin/edit.php',
  'add new post': '/wp-admin/post-new.php',
  'categories': '/wp-admin/edit-tags.php?taxonomy=category',
  'tags': '/wp-admin/edit-tags.php?taxonomy=post_tag',
  'pages': '/wp-admin/edit.php?post_type=page',
  'add new page': '/wp-admin/post-new.php?post_type=page',
  'media': '/wp-admin/upload.php',
  'media library': '/wp-admin/upload.php',
  'add media file': '/wp-admin/media-new.php',
  'comments': '/wp-admin/edit-comments.php',
  'themes': '/wp-admin/themes.php',
  'editor': '/wp-admin/site-editor.php',
  'navigation': '/wp-admin/site-editor.php?p=%2Fnavigation',
  'patterns': '/wp-admin/site-editor.php?p=%2Fpattern',
  'menus': '/wp-admin/nav-menus.php',
  'widgets': '/wp-admin/widgets.php',
  'plugins': '/wp-admin/plugins.php',
  'users': '/wp-admin/users.php',
  'profile': '/wp-admin/profile.php',
  'tools': '/wp-admin/tools.php',
  'site health': '/wp-admin/site-health.php',
  'general settings': '/wp-admin/options-general.php',
  'writing settings': '/wp-admin/options-writing.php',
  'reading settings': '/wp-admin/options-reading.php',
  'discussion settings': '/wp-admin/options-discussion.php',
  'media settings': '/wp-admin/options-media.php',
  'permalinks': '/wp-admin/options-permalink.php',
};

/**
 * The path of a named administration screen.
 *
 * @param {string} name
 * @returns {string}
 */
function adminScreenPath(name) {
  const path = ADMIN_SCREENS[String(name).trim().toLowerCase()];
  if (!path) {
    throw friendly({
      message: `"${name}" is not a known administration screen.`,
      hint: `Known screens: ${Object.keys(ADMIN_SCREENS).join(', ')}. For any other path use: Given I am on "/wp-admin/...".`,
    });
  }
  return path;
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

/**
 * The nonce WordPress asks of a cookie-authenticated REST request, or an empty
 * string for an anonymous session. Without it a logged-in session is treated
 * as anonymous by the REST API, which is the intended protection against
 * cross-site requests.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function restNonce(world) {
  const response = await world.context.request.get(joinUrl(world.launchUrl, '/wp-admin/admin-ajax.php?action=rest-nonce'), { failOnStatusCode: false });
  const text = (await response.text()).trim();
  return response.status() === 200 && /^[a-f0-9]{6,}$/i.test(text) ? text : '';
}

/**
 * Send a request to the REST API as the browser session: authenticated when
 * the session is logged in, anonymous otherwise. `route` is the part after the
 * REST prefix, with its query string: `/wp/v2/posts?per_page=1`.
 *
 * With `prefix` `rest_route` the request goes to `/?rest_route=` instead of
 * `/wp-json`, which resolves on a site with plain permalinks too.
 *
 * @param {object} world
 * @param {string} route
 * @param {{method?: string, data?: object, prefix?: 'wp-json'|'rest_route'}} [options]
 * @returns {Promise<{status: number, headers: object, text: string, json: *, url: string}>}
 */
async function restRequest(world, route, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const normalized = '/' + String(route).replace(/^\/+/, '');
  let url;
  if (options.prefix === 'rest_route') {
    const [path, query] = normalized.split('?');
    url = siteRoot(world.launchUrl) + '/?rest_route=' + encodeURIComponent(path) + (query ? '&' + query : '');
  } else {
    url = siteRoot(world.launchUrl) + '/wp-json' + normalized;
  }
  const headers = { Accept: 'application/json' };
  const nonce = await restNonce(world);
  if (nonce) headers['X-WP-Nonce'] = nonce;
  const requestOptions = { headers, failOnStatusCode: false };
  if (options.data !== undefined) requestOptions.data = options.data;
  let response;
  try {
    response = await world.context.request.fetch(url, Object.assign({ method }, requestOptions));
  } catch (err) {
    throw friendly({
      message: `Could not reach the REST API at ${url}.`,
      cause: err,
      hint: 'Check that launchUrl points at the running site and that the host is reachable from the test runner.',
    });
  }
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status(), headers: response.headers(), text, json, url };
}

/**
 * Ask the site for real content, so a scenario never hard-codes a slug, a date
 * or a category name. Uses `?rest_route=`: the pretty `/wp-json/` path only
 * resolves once a permalink structure registered its rewrite rule.
 *
 * @param {object} world
 * @param {string} route - For example `/wp/v2/posts`.
 * @param {object} params - Query parameters.
 * @param {string} describe - What the route lists, for the message.
 * @returns {Promise<object>} The first item.
 */
async function discoverContent(world, route, params, describe) {
  const query = new URLSearchParams(params).toString();
  const result = await restRequest(world, route + (query ? '?' + query : ''), { prefix: 'rest_route' });
  if (result.status !== 200) {
    throw friendly({
      message: `The content API ("${route}") responded ${result.status} instead of 200.`,
      hint: 'The site may have the REST API disabled, or launchUrl may point at the wrong host.',
    });
  }
  if (!Array.isArray(result.json) || result.json.length === 0) {
    throw friendly({
      message: `The content API returned no ${describe}.`,
      hint: `Publish at least one ${describe} on the site under test, or drop the scenario that needs one.`,
    });
  }
  return result.json[0];
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '\u2026', ndash: '\u2013', mdash: '\u2014', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d' };

/**
 * The text of a REST `rendered` field, as the browser shows it: tags removed
 * and entities decoded. WordPress texturizes titles (`'` becomes `&#8217;`), so
 * the raw `title.rendered` never equals the text on the page.
 *
 * @param {string} html
 * @returns {string}
 */
function renderedText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => (name.toLowerCase() in NAMED_ENTITIES ? NAMED_ENTITIES[name.toLowerCase()] : m))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Open a page by its query-var URL (`?p=`, `?page_id=`, `?cat=`), which is
 * honoured whatever the permalink structure is; the REST `link` field is a
 * pretty permalink that only resolves when the rewrite rules are wired up.
 *
 * @param {object} world
 * @param {string} query
 * @returns {Promise<import('playwright').Response|null>}
 */
async function gotoQuery(world, query) {
  return navigate(world, '/?' + query);
}

module.exports = {
  WAIT_TIMEOUT,
  ADMIN_SCREENS,
  supplied,
  budget,
  settle,
  siteRoot,
  joinUrl,
  navigate,
  textPattern,
  expectText,
  expectRendered,
  resolveUser,
  openLogin,
  submitLogin,
  loginAs,
  isLoggedIn,
  adminScreenPath,
  restNonce,
  restRequest,
  discoverContent,
  renderedText,
  gotoQuery,
};
