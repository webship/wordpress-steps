'use strict';

// WordPress step definitions for webship-js: the machine-readable site.
//
// The REST API (`/wp-json/`), the RSS feeds, `robots.txt` and the XML sitemap.
// These steps ask the server directly, as the browser session: authenticated
// when a "logged in user" step ran, anonymous otherwise.

const { Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const { joinUrl, restRequest, supplied } = require('./wordpress-helpers');

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Read a value from a parsed JSON document by a dotted path; array items are
// addressed by their index: `0.title.rendered`.
function valueAt(document, dottedPath) {
  return String(dottedPath).split('.').reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), document);
}

// One request, made as the browser session.
async function fetchRoute(world, route) {
  return restRequest(world, route);
}

/**
 * Assert the REST API is available at `/wp-json/` and serves the core
 * namespace `wp/v2`. It is what the block editor and every headless client
 * depend on.
 *
 * Example #1: Then the REST API should be available
 * Example #2: And the REST API should be available
 * Example #3: Then the REST API should not be available
 * Example #4: And the REST API should not be available
 * Example #5: But the REST API should be available
 *
 */
Then(/^the REST API should( not)* be available$/, async function (notCase) {
  const result = await restRequest(this, '/');
  const available = result.status === 200 && Boolean(result.json) && Array.isArray(result.json.namespaces) && result.json.namespaces.includes('wp/v2');
  if (available === Boolean(notCase)) {
    throw friendly({
      message: notCase ? 'Expected the REST API not to be available.' : 'Expected the REST API to be available at /wp-json/.',
      cause: `${result.url} answered ${result.status}`,
      hint: 'Pretty permalinks route /wp-json/; a site with plain permalinks serves /?rest_route=/ instead. A security plugin may block the API.',
    });
  }
});

/**
 * Assert a REST route answers with a status code. The route is the part after
 * `/wp-json`, with its query string, and the request is made as the logged-in
 * user, or as a visitor.
 *
 * Example #1: Then the REST route "/wp/v2/posts" should respond with status 200
 * Example #2: And the REST route "/wp/v2/pages?per_page=1" should respond with status 200
 * Example #3: Then the REST route "/wp/v2/posts/999999999" should respond with status 404
 * Example #4: And the REST route "/wp/v2/users/me" should respond with status 401
 * Example #5: Then the REST route "/wp/v2/settings" should respond with status 401
 *
 */
Then(/^the REST route "([^"]*)" should respond with status (\d+)$/, async function (route, status) {
  const result = await fetchRoute(this, route);
  if (result.status !== parseInt(status, 10)) {
    throw friendly({
      message: `Expected the REST route "${route}" to respond with status ${status}.`,
      cause: `it answered ${result.status}${result.json && result.json.code ? ` (${result.json.code})` : ''}`,
      hint: result.status === 401 ? 'The route needs a logged-in user: Given I am a logged in user with the "admin" user.' : undefined,
    });
  }
});

/**
 * Assert a REST route asks for authentication, or does not: it answers a
 * visitor with 401 (or 403) when it does. It is the check that private
 * routes, such as the current user and the settings, stay private.
 *
 * Example #1: Then the REST route "/wp/v2/users/me" should require authentication
 * Example #2: And the REST route "/wp/v2/settings" should require authentication
 * Example #3: Then the REST route "/wp/v2/posts" should not require authentication
 * Example #4: And the REST route "/wp/v2/posts?status=draft" should require authentication
 * Example #5: But the REST route "/wp/v2/pages" should not require authentication
 *
 */
Then(/^the REST route "([^"]*)" should( not)* require authentication$/, async function (route, notCase) {
  const result = await fetchRoute(this, route);
  const required = result.status === 401 || result.status === 403;
  if (required === Boolean(notCase)) {
    throw friendly({
      message: notCase
        ? `Expected the REST route "${route}" to be public.`
        : `Expected the REST route "${route}" to require authentication.`,
      cause: `it answered ${result.status}${result.json && result.json.code ? ` (${result.json.code})` : ''}`,
      hint: notCase
        ? 'The route answered 401 or 403 to this session. A public route answers a visitor with 200.'
        : 'Run it as a visitor: Given I am an anonymous user. A logged-in session is authenticated, so the route answers it.',
    });
  }
});

/**
 * Assert a REST route is refused to the session: it answers 400, 401 or 403.
 * WordPress answers 401 when a login would help, 403 when the account lacks
 * the capability and 400 when a parameter is not allowed for the account, as
 * for `status=draft` asked by a visitor. Use it for content a visitor must not
 * be given.
 *
 * Example #1: Then the REST route "/wp/v2/posts?status=draft" should be refused
 * Example #2: And the REST route "/wp/v2/posts?status=private" should be refused
 * Example #3: Then the REST route "/wp/v2/users/me" should be refused
 * Example #4: And the REST route "/wp/v2/settings" should not be refused
 * Example #5: But the REST route "/wp/v2/posts" should not be refused
 *
 */
Then(/^the REST route "([^"]*)" should( not)* be refused$/, async function (route, notCase) {
  const result = await fetchRoute(this, route);
  const refused = [400, 401, 403].includes(result.status);
  if (refused === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the REST route "${route}" not to be refused.` : `Expected the REST route "${route}" to be refused.`,
      cause: `it answered ${result.status}${result.json && result.json.code ? ` (${result.json.code})` : ''}`,
      hint: 'Run it as a visitor with: Given I am an anonymous user. A logged-in administrator is given everything.',
    });
  }
});

/**
 * Assert a REST route lists at least a number of items. The route must answer
 * with a JSON list, as `/wp/v2/posts`, `/wp/v2/pages` and `/wp/v2/categories`
 * do.
 *
 * Example #1: Then the REST route "/wp/v2/posts" should list at least 1 item
 * Example #2: And the REST route "/wp/v2/pages" should list at least 1 item
 * Example #3: Then the REST route "/wp/v2/categories" should list at least 1 items
 * Example #4: And the REST route "/wp/v2/posts?search=hello" should list at least 1 item
 * Example #5: Then the REST route "/wp/v2/tags" should list at least 0 items
 *
 */
Then(/^the REST route "([^"]*)" should list at least (\d+) items?$/, async function (route, count) {
  const result = await fetchRoute(this, route);
  if (result.status !== 200 || !Array.isArray(result.json)) {
    throw friendly({
      message: `Expected the REST route "${route}" to answer with a list.`,
      cause: `it answered ${result.status}${result.json && result.json.code ? ` (${result.json.code})` : ''}`,
    });
  }
  if (result.json.length < parseInt(count, 10)) {
    throw friendly({
      message: `Expected the REST route "${route}" to list at least ${count} item(s).`,
      cause: `it lists ${result.json.length}`,
      hint: 'A visitor sees published content only; log in to see drafts.',
    });
  }
});

/**
 * Assert a value in the JSON a REST route returns, by its path: `slug`,
 * `title.rendered`, `status`, or `0.slug` for the first item of a list.
 *
 * Example #1: Then the REST route "/wp/v2/posts/1" should have "slug" equal to "hello-world"
 * Example #2: And the REST route "/wp/v2/posts/1" should have "status" equal to "publish"
 * Example #3: Then the REST route "/wp/v2/posts/1" should have "title.rendered" equal to "Hello world!"
 * Example #4: And the REST route "/wp/v2/posts?per_page=1" should have "0.type" equal to "post"
 * Example #5: Then the REST route "/wp/v2/users/me" should have "slug" equal to "admin"
 *
 */
Then(/^the REST route "([^"]*)" should have "([^"]*)" equal to "([^"]*)"$/, async function (route, property, expected) {
  const result = await fetchRoute(this, route);
  if (result.status !== 200 || result.json === null) {
    throw friendly({
      message: `Expected the REST route "${route}" to answer with JSON.`,
      cause: `it answered ${result.status}${result.json && result.json.code ? ` (${result.json.code})` : ''}`,
      hint: result.status === 401 ? 'The route needs a logged-in user.' : undefined,
    });
  }
  const actual = valueAt(result.json, property);
  if (String(actual) !== expected) {
    throw friendly({
      message: `Expected "${property}" of the REST route "${route}" to be "${expected}".`,
      cause: supplied(actual) ? `it is "${typeof actual === 'object' ? JSON.stringify(actual) : actual}"` : 'the property does not exist',
    });
  }
});

// ---------------------------------------------------------------------------
// Feeds
// ---------------------------------------------------------------------------

const FEEDS = {
  site: '/feed/',
  comments: '/comments/feed/',
};

// The two feed formats WordPress serves: RSS 2.0 at `/feed/` and Atom at
// `/feed/atom/`. Each has its own root element, title and entry element.
const FEED_FORMATS = {
  RSS: {
    root: /<rss[\s>]/,
    title: /<channel>[\s\S]*?<title[\s>]/,
    item: /<item[\s>]/g,
    describe: 'no <rss> and <channel> elements with a title',
  },
  Atom: {
    root: /<feed[^>]*xmlns="http:\/\/www\.w3\.org\/2005\/Atom"/,
    title: /<feed[\s\S]*?<title[\s>]/,
    item: /<entry[\s>]/g,
    describe: 'no <feed> element in the Atom namespace with a title',
  },
};

// Fetch a feed and check its format: the status, the XML content type, the
// root element and the feed title. Returns the body and its item count.
async function readFeed(world, path, format = 'RSS') {
  const response = await world.context.request.get(joinUrl(world.launchUrl, path), { failOnStatusCode: false });
  const body = await response.text();
  const type = response.headers()['content-type'] || '';
  const rules = FEED_FORMATS[format];
  const problems = [];
  if (response.status() !== 200) problems.push(`status ${response.status()}`);
  if (!/xml/.test(type)) problems.push(`content type "${type}"`);
  if (!rules.root.test(body) || !rules.title.test(body)) problems.push(rules.describe);
  if (problems.length) {
    const other = format === 'RSS' ? 'Atom' : 'RSS';
    const isOther = response.status() === 200 && FEED_FORMATS[other].root.test(body);
    throw friendly({
      message: `The feed "${path}" is not a valid ${format} feed.`,
      cause: problems.join(', '),
      hint: isOther
        ? `It is an ${other} feed. Use: Then the feed "${path}" should be a valid ${other} feed.`
        : 'WordPress serves RSS at /feed/ and /comments/feed/, and Atom at /feed/atom/; a plugin may redirect or turn the feeds off, and PHP notices before the XML break it.',
    });
  }
  return { body, items: (body.match(rules.item) || []).length };
}

/**
 * Assert a feed is valid RSS or Atom: the site feed, the comments feed or a
 * feed at a path, such as a category feed, an author feed or the Atom feed at
 * `/feed/atom/`. It checks the status, the XML content type, the root element
 * of the format (`rss` with a `channel`, or `feed` in the Atom namespace) and
 * the feed title, and optionally that the feed has at least a number of items.
 *
 * Example #1: Then the site feed should be a valid RSS feed
 * Example #2: And the comments feed should be a valid RSS feed
 * Example #3: Then the feed "/category/uncategorized/feed/" should be a valid RSS feed
 * Example #4: And the site feed should be a valid RSS feed with at least 1 item
 * Example #5: Then the feed "/feed/atom/" should be a valid Atom feed with at least 1 item
 *
 */
Then(/^the (?:(site|comments) feed|feed "([^"]*)") should be a valid (RSS|Atom) feed(?: with at least (\d+) items?)?$/, async function (named, path, format, count) {
  const target = path || FEEDS[named];
  const feed = await readFeed(this, target, format);
  if (supplied(count) && feed.items < parseInt(count, 10)) {
    throw friendly({
      message: `Expected the feed "${target}" to have at least ${count} item(s).`,
      cause: `it has ${feed.items}`,
      hint: 'Publish content for the feed, or check how many items the site shows in feeds (Settings > Reading).',
    });
  }
});

/**
 * Assert the site feed lists an entry by its title, or does not.
 *
 * Example #1: Then the site feed should list "Hello world!"
 * Example #2: And the site feed should list "Sample"
 * Example #3: Then the site feed should not list "Privacy Policy"
 * Example #4: And the comments feed should not list "Secret"
 * Example #5: Then the comments feed should list "WordPress Commenter"
 *
 */
Then(/^the (site|comments) feed should( not)* list "([^"]*)"$/, async function (named, notCase, text) {
  const feed = await readFeed(this, FEEDS[named]);
  // The feed carries the title as XML text: entities for quotes and ampersands.
  const plain = feed.body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#8217;/g, '’').replace(/&amp;/g, '&');
  if (plain.includes(text) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the ${named} feed not to list "${text}".` : `Expected the ${named} feed to list "${text}".`,
      hint: 'Only published content is in a public feed; the text is matched anywhere in the feed.',
    });
  }
});

// ---------------------------------------------------------------------------
// robots.txt and the sitemap
// ---------------------------------------------------------------------------

async function readText(world, path) {
  const response = await world.context.request.get(joinUrl(world.launchUrl, path), { failOnStatusCode: false });
  return { status: response.status(), type: response.headers()['content-type'] || '', body: await response.text() };
}

/**
 * Assert the site serves `robots.txt` as plain text. WordPress generates a
 * virtual one when no file exists. A web server that does not hand the request
 * to WordPress, such as the stock DDEV nginx configuration, answers 404.
 *
 * Example #1: Then the robots.txt file should be served
 * Example #2: And the robots.txt file should be served
 * Example #3: Then robots.txt should be served
 * Example #4: And robots.txt should be served
 * Example #5: But the robots.txt file should be served
 *
 */
Then(/^(?:the )?robots\.txt(?: file)? should be served$/, async function () {
  const robots = await readText(this, '/robots.txt');
  if (robots.status !== 200 || !/text\/plain/.test(robots.type) || !/user-agent:/i.test(robots.body)) {
    throw friendly({
      message: 'Expected /robots.txt to be served as plain text with a User-agent rule.',
      cause: `it answered ${robots.status}${robots.type ? `, content type "${robots.type}"` : ''}`,
      hint: 'WordPress answers /robots.txt itself only when the web server passes the request to index.php (rewrite rule robots.txt to index.php?robots=1). With DDEV, add a robots.txt file or an nginx rule.',
    });
  }
});

/**
 * Assert `robots.txt` disallows, or allows, a path. The path is matched as a
 * `Disallow` rule: `/wp-admin/` is the rule WordPress writes for the
 * administration area.
 *
 * Example #1: Then robots.txt should disallow "/wp-admin/"
 * Example #2: And robots.txt should not disallow "/"
 * Example #3: Then the robots.txt file should disallow "/wp-admin/"
 * Example #4: And the robots.txt file should not disallow "/wp-content/uploads/"
 * Example #5: But robots.txt should not disallow "/feed/"
 *
 */
Then(/^(?:the )?robots\.txt(?: file)? should( not)* disallow "([^"]*)"$/, async function (notCase, rulePath) {
  const robots = await readText(this, '/robots.txt');
  if (robots.status !== 200) {
    throw friendly({ message: 'Could not read /robots.txt.', cause: `it answered ${robots.status}`, hint: 'See: Then robots.txt should be served.' });
  }
  const disallowed = robots.body.split(/\r?\n/).some((line) => {
    const match = line.match(/^\s*Disallow:\s*(\S*)/i);
    return Boolean(match) && match[1] === rulePath;
  });
  if (disallowed === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected robots.txt not to disallow "${rulePath}".` : `Expected robots.txt to disallow "${rulePath}".`,
      cause: `robots.txt reads: ${robots.body.replace(/\s+/g, ' ').slice(0, 200)}`,
    });
  }
});

/**
 * Assert `robots.txt` points to the XML sitemap with a `Sitemap` line.
 *
 * Example #1: Then robots.txt should list the sitemap
 * Example #2: And robots.txt should list the sitemap
 * Example #3: Then the robots.txt file should list the sitemap
 * Example #4: And the robots.txt file should list the sitemap
 * Example #5: But robots.txt should not list the sitemap
 *
 */
Then(/^(?:the )?robots\.txt(?: file)? should( not)* list the sitemap$/, async function (notCase) {
  const robots = await readText(this, '/robots.txt');
  const listed = /^\s*Sitemap:\s*\S+/im.test(robots.body);
  if (robots.status !== 200 || listed === Boolean(notCase)) {
    throw friendly({
      message: notCase ? 'Expected robots.txt not to list the sitemap.' : 'Expected robots.txt to list the sitemap.',
      cause: robots.status === 200 ? 'there is no Sitemap line' : `it answered ${robots.status}`,
      hint: 'WordPress adds the Sitemap line when the site is open to search engines (Settings > Reading).',
    });
  }
});

/**
 * Assert the XML sitemap is served at `/wp-sitemap.xml`, the index core
 * generates, and optionally that it lists a kind of sitemap or a URL part.
 *
 * Example #1: Then the XML sitemap should be served
 * Example #2: And the XML sitemap should be served
 * Example #3: Then the XML sitemap should list "wp-sitemap-posts-post-1.xml"
 * Example #4: And the XML sitemap should list "wp-sitemap-posts-page-1.xml"
 * Example #5: Then the XML sitemap should list "wp-sitemap-users-1.xml"
 *
 */
Then(/^the XML sitemap should (?:be served|list "([^"]*)")$/, async function (expected) {
  const sitemap = await readText(this, '/wp-sitemap.xml');
  if (sitemap.status !== 200 || !/xml/.test(sitemap.type) || !/<(sitemapindex|urlset)[\s>]/.test(sitemap.body)) {
    throw friendly({
      message: 'Expected the XML sitemap at /wp-sitemap.xml.',
      cause: `it answered ${sitemap.status}${sitemap.type ? `, content type "${sitemap.type}"` : ''}`,
      hint: 'Core sitemaps need a site open to search engines (Settings > Reading) and are off when a plugin replaces them.',
    });
  }
  if (supplied(expected) && !sitemap.body.includes(expected)) {
    throw friendly({
      message: `Expected the XML sitemap to list "${expected}".`,
      cause: `it lists: ${(sitemap.body.match(/<loc>[^<]+<\/loc>/g) || []).map((loc) => loc.replace(/<\/?loc>/g, '')).join(', ') || '(nothing)'}`,
    });
  }
});
