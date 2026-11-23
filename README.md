<p align="center"><img src="https://raw.githubusercontent.com/webship/wordpress-steps/2.0.x/assets/logo.svg" alt="WordPress logo" width="96"></p>

# wordpress-steps

[![Test](https://github.com/webship/wordpress-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/wordpress-steps/actions/workflows/test.yml)

WordPress step definitions for [webship-js](https://www.npmjs.com/package/webship-js), the Playwright and Cucumber framework for behaviour-driven testing. `@webship-js/wordpress-steps` lets a tester write readable Gherkin scenarios for a WordPress site: sessions and roles, the administration area, content in the block editor, comments, search, the REST API, feeds and accessibility. The steps know WordPress's own markup (`#wpadminbar`, `#loginform`, `#adminmenu`, the block editor, `.wp-block-*`) and find real content through the REST API, so a scenario names no CSS selector and no slug.

Anything webship-js already covers (body classes, landmarks, status codes, element assertions, accessibility audits) is used from webship-js and not redefined here.

It is a **plugin for webship-js** and does not run on its own. You add it to a webship-js test project.

### Tested against

The pack's own suite runs against a real WordPress site in CI (built with [DDEV](https://ddev.com/)) and was developed against WordPress 7.1 with the Twenty Twenty-Five block theme. The steps cover block themes and classic themes where the markup is shared; steps that exist only in a block theme (template parts, the Site Editor) say so in their documentation.

## What is covered

- **Sessions and accounts:** login by a handle from the users registry (no password in a feature file), explicit credentials, the login screen and its error and message notices, logout the way a user does, the lost password screen, "logged in as" checked on the server, the account's role, and the admin bar.
- **The public site:** front page, pages, posts, category archives, the 404 page, the site title and the comment form.
- **Search:** open the results for a term, use the search form, assert that results exist or that none were found, and that a result lists an entry.
- **Roles and screens:** the administration screens by name (`Given I am on the "Plugins" admin screen`), the landing screen of each role, and the access denied screen a role without the capability gets.
- **The administration area:** the dashboard and its widgets, the admin menu and its submenus, the admin bar, notices (success, error, warning, info), the plugins and themes screens (installed, active, activate and deactivate a plugin, block or classic theme), settings (site title and any labelled setting, the permalink structure), Site Health tests, and the cron endpoint.
- **Content in the block editor:** new post or page, open an entry by title, set the title, write a paragraph, publish, update, save a draft, submit for review (contributor), move to the trash, restore, delete permanently, the status of an entry, what the editor offers each role; categories and tags (add, delete, file a post, tag a post, assert on the public post); the media library (upload, list, delete).
- **Comments:** submit a comment (visitor or logged in), see it awaiting moderation, approve, unapprove, trash, mark as spam, restore and delete it on the Comments screen, and assert the status of a comment.
- **The theme:** the navigation menu (list, open, the mobile menu), core blocks by name, the header and footer template parts, the REST API and feed links in the page head.
- **The machine-readable site:** the REST API (available, status, requires authentication, refused, list, a value), the RSS and Atom feeds, `robots.txt` and the XML sitemap.
- **Accessibility:** a feature that audits the front page, a post, the login page and the 404 page with webship-js's axe steps.

Each step is documented with a JSDoc block and Gherkin examples in [`tests/step-definitions/`](tests/step-definitions/): `wordpress-session.steps.js` (sessions, accounts, roles), `wordpress.steps.js` (the public site), `wordpress-admin.steps.js` (the administration area), `wordpress-content.steps.js` (the block editor, lists, categories, tags and media), `wordpress-comments.steps.js` (comments and moderation), `wordpress-site.steps.js` (navigation, blocks, the page head), `wordpress-api.steps.js` (REST, feeds, robots, sitemap) and `wordpress-helpers.js` (shared helpers, no steps).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), curl, and Node.js 24 or later with npm. PHP, WP-CLI and the database run in DDEV's containers.

**1. The WordPress site.** These are the commands CI runs (`.github/workflows/test.yml`): the latest WordPress with its default theme, the five accounts of [Test users](#test-users), the rewrite rules written out, and the `robots.txt` WordPress generates. It takes about a minute.

```bash
mkdir wordpress-site && cd wordpress-site
ddev config --project-type=wordpress --project-name=wordpress-steps --docroot=web
ddev start
ddev wp core download --path=web
ddev wp config create --path=web --dbname=db --dbuser=db --dbpass=db --dbhost=db --skip-check --force
ddev wp core install --path=web --url="https://wordpress-steps.ddev.site" \
  --title="Webship Test Site" --admin_user=admin --admin_password=admin \
  --admin_email=admin@example.com --skip-email
for role in editor author contributor subscriber; do
  ddev wp user create "$role" "$role@example.com" --role="$role" --user_pass="$role" --path=web
done
ddev wp rewrite flush --hard --path=web
curl -fsSk "https://wordpress-steps.ddev.site/?robots=1" -o web/robots.txt
cd ..
```

The site answers at `https://wordpress-steps.ddev.site`. (The stock DDEV web server answers `/robots.txt` itself, hence the last command.)

In the [Webship Workspace](https://github.com/webship/workspace), its WordPress plugin builds the site instead, the latest WordPress, in a sites folder of the workspace (`test/` here; `dev/`, `sandboxes/` and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require wordpress --with-needs
bash core/scripts/plugins.sh --activate wordpress --with-needs
bash core/scripts/plugins.sh --install wordpress
bash test/cmd-wordpress-project.sh mysite --install --add-users
```

That site answers at `https://mysite.ddev.site`. Its accounts are the plugin's (`administrator`, `editor`, `author`, `contributor` and `subscriber`, each with the password `dD.123123ddd`; step 3 names them). The features of
[`tests/features/`](tests/features/) pass there too, once WordPress's own
`robots.txt` is written into the site's folder the way the last command above
does it: `curl -fsSk "https://mysite.ddev.site/?robots=1" -o test/mysite/robots.txt`.

**2. A test project.**

```bash
mkdir wordpress-tests && cd wordpress-tests
npm init -y
npm install --save-dev webship-js @webship-js/wordpress-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the `npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the address of the site, and the accounts (the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/wordpress-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://wordpress-steps.ddev.site',
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        admin: { username: 'admin', password: 'admin' },
        editor: { username: 'editor', password: 'editor' },
        author: { username: 'author', password: 'author' },
        contributor: { username: 'contributor', password: 'contributor' },
        subscriber: { username: 'subscriber', password: 'subscriber' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1), the accounts are the plugin's: `admin: { username: 'administrator', password: 'dD.123123ddd' }`, and `editor`, `author`, `contributor` and `subscriber` with the same password. Its address goes in `LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: An editor logs in and lands on the dashboard
    Given I am a logged in user with the "editor" user
    Then I should be on the "Dashboard" admin screen
    And the admin menu should list "Posts"

  Scenario: A visitor opens a post
    Given I am an anonymous user
    And I am on a post
    Then I should see the post title
```

**5. Run it.**

```bash
npm test
```

(`LAUNCH_URL=https://mysite.ddev.site npm test` for a site at another address.)
A green first run prints every step, then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed) and the HTML report it wrote:

```
3 scenarios (3 passed)
8 steps (8 passed)
0m06.000s (executing steps: 0m05.900s)
[webship-js] HTML report → …/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under `node_modules/@webship-js/wordpress-steps/tests/features/`): together they use every step of the pack, in both readings where a step reads both ways. The media features upload `webshipco.png` and `test-document.pdf` from `tests/assets/`, which ship as well: copy them into the project's `tests/assets/` with the features. Steps that check a status code over HTTPS read DDEV's certificate authority: run them with `NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`, as CI does.

### What the suite tests

The features of this repository run every step of the pack against the default site, in CI on every change: logging in and out, the login screen and its notices, the lost password screen, each role's landing screen, menus, admin bar and refusals, the dashboard and its widgets, posts and pages in the block editor (create, publish, update, draft, submit for review, trash, restore, delete), categories and tags, the media library, comments and their moderation, search, the navigation menu, blocks and template parts, the 404 page, settings, plugins and themes, Site Health, the REST API, the feeds, `robots.txt`, the sitemap and an accessibility audit.

Not tested: the Site Editor and the Customizer, menus of classic themes and widgets (the default theme is a block theme), multisite, user and role management (the suite never creates accounts), installing plugins and themes, and e-mail delivery (the lost password scenario stops at the screen that says an e-mail was sent).

## Requirements

- Node.js >= 24
- An existing [webship-js](https://www.npmjs.com/package/webship-js) 2.x test project (or run `npx init-webship-js` to create one)

## Installation

```bash
npm install --save-dev webship-js @webship-js/wordpress-steps
```

Add both step-definition paths to your project's `cucumber.js`:

```javascript
module.exports = {
  default: {
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js', // webship-js core steps
      'node_modules/@webship-js/wordpress-steps/tests/step-definitions/**/*.js', // this plugin
      'tests/step-definitions/**/*.js', // your own custom steps, if any
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://your-wordpress-site.example',
      // The users registry: handles a feature can read, mapped to real accounts.
      users: {
        admin: { username: process.env.WP_ADMIN_USER || 'admin', password: process.env.WP_ADMIN_PASSWORD || 'admin' },
        editor: { username: 'editor', password: process.env.WP_EDITOR_PASSWORD },
      },
      // ...
    },
  },
};
```

This repository's own [`tests/features/`](tests/features/) directory is a working reference project for the `cucumber.js` setup above.

## Quick example

```gherkin
Feature: The administration area

  Scenario: An editor sees a smaller admin menu
    Given I am a logged in user with the "editor" user
    When I go to the "Dashboard" admin screen
    Then the admin menu should list "Posts"
    And the admin menu should not list "Plugins"
```

The scenario logs in by a handle of the users registry (see [Accounts](#accounts)), so no password is in the feature file.

```gherkin
Feature: Homepage

  Scenario: The front page is served and uses the home template
    Given I am an anonymous user
    And I am on the homepage
    Then the response status code should be 200
    And "body" should have class "home"
    And I should see the site title
    And the page should have a navigation landmark
```

Steps like `"body" should have class "home"` and `the page should have a navigation landmark` come from webship-js itself; only `I should see the site title` is from this pack.

More runnable examples: [tests/features/](tests/features/).

## Accounts

Features log in by a handle from the users registry, `worldParameters.users` in `cucumber.js`. The handle maps to the real account, so a feature never carries a password:

```gherkin
Given I am a logged in user with the "editor" user
Then I should be logged in as the "editor" user
And my account should have the "editor" role
And I should be on the "Dashboard" admin screen
```

This repository's `cucumber.js` registers `admin`, `editor`, `author`, `contributor` and `subscriber`. Each account name and password defaults to the handle and is overridden by `WP_<HANDLE>_USER` and `WP_<HANDLE>_PASSWORD`, for example `WP_ADMIN_USER=webmaster`. Accounts are configuration: create them once on the site, for example `wp user create editor editor@example.com --role=editor --user_pass=editor`. A feature never creates or deletes an account.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the default values; each one can be replaced through `WP_<HANDLE>_USER` and `WP_<HANDLE>_PASSWORD`). `wp core install` creates `admin` (an administrator) and `wp user create` the four others, each with the role of the same name: CI does it on the runner, and the commands under [Running this repository's own test suite](#running-this-repositorys-own-test-suite) do it locally. They are placeholder credentials of that throwaway site, not of any real one.

```json
{
  "admin": { "username": "admin", "password": "admin" },
  "editor": { "username": "editor", "password": "editor" },
  "author": { "username": "author", "password": "author" },
  "contributor": { "username": "contributor", "password": "contributor" },
  "subscriber": { "username": "subscriber", "password": "subscriber" }
}
```

## Running this repository's own test suite

This repository is itself a working webship-js project: its `tests/features/*.feature` files run against the WordPress site `LAUNCH_URL` points to. The features name the content of a default install ("Hello world!", "Sample Page") and the five accounts of the users registry.

```bash
npm install
npx playwright install --with-deps chromium
LAUNCH_URL=https://your-site.example npm test   # runs against your own site
```

CI (`.github/workflows/test.yml`) does not depend on an external site: it builds a default WordPress install on the runner with [DDEV](https://ddev.com/) and runs the suite against it. To do the same locally:

```bash
ddev config --project-type=wordpress --project-name=wordpress-steps --docroot=web
ddev start
ddev wp core download --path=web
ddev wp config create --path=web --dbname=db --dbuser=db --dbpass=db --dbhost=db --skip-check --force
ddev wp core install --path=web --url="https://wordpress-steps.ddev.site" \
  --title="Webship Test Site" --admin_user=admin --admin_password=admin \
  --admin_email=admin@example.com --skip-email
for role in editor author contributor subscriber; do
  ddev wp user create "$role" "$role@example.com" --role="$role" --user_pass="$role" --path=web
done
ddev wp rewrite flush --hard --path=web

# The stock DDEV nginx configuration answers /robots.txt with a 404 instead of
# passing it to WordPress; write the file WordPress generates for the robots.txt steps.
curl -fsSk "https://wordpress-steps.ddev.site/?robots=1" -o web/robots.txt

LAUNCH_URL=https://wordpress-steps.ddev.site npm test
```

Other scripts:

| Script | Effect |
| --- | --- |
| `npm test` | Full suite, pretty output |
| `npm run test:dry` | `--dry-run`: checks for undefined and ambiguous steps only |
| `npm run test:examples` | No browser: every step's JSDoc carries five `Example #n:` lines that match its own definition and no other, and every feature step resolves to exactly one definition (also runs in CI) |
| `npm run test:paths` | No browser: a feature or a scenario named on the command line runs alone, and naming none runs the whole suite (also runs in CI) |
| `npm run test:headed` | Headed browser |
| `npm run test:chromium` / `test:firefox` / `test:webkit` | Pick a browser |

### Lanes, subsets and the settings webship-js reads

- `npx cucumber-js tests/features/login.feature` runs one feature and `npx cucumber-js tests/features/login.feature:<line>` one scenario (the line of its `Scenario:`); the paths of `cucumber.js` are left out when the command line names any.
- `FEATURES=tests/features/a.feature,tests/features/b.feature npm test` runs a subset of the feature files; `CUCUMBER_TAGS=@critical npm test` runs a tag lane (the default run leaves `@wip` out).
- `cucumber.js` carries the `video` block (`WEBSHIP_VIDEO=on-failure` records the browser) and the `javascript` block (`WEBSHIP_JS_ERROR_MODE=fail` fails a scenario on a JavaScript error; `@js-off` silences one scenario) that webship-js reads.
- The step timeout is webship-js's own (45 seconds, set when it loads); `WEBSHIP_STEP_TIMEOUT=<milliseconds>` changes it, a `timeout` key in `cucumber.js` does not.

## Contributing

Issues and pull requests are tracked on GitHub. `2.0.x` is the repository's single active branch.

## License

MIT © Webship.co. See [LICENSE](LICENSE).

## Logo

The WordPress logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The WordPress name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
