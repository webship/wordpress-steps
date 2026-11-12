# wordpress-steps

[![Test](https://github.com/webship/wordpress-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/wordpress-steps/actions/workflows/test.yml)

WordPress-specific Cucumber step definitions for [webship-js](https://www.npmjs.com/package/webship-js) — a Playwright + Cucumber BDD testing framework. `@webship-js/wordpress-steps` adds a `wordpress.steps.js` step-pack that understands WordPress's own markup conventions (`#wpadminbar`, `#loginform`, `.site-title`, comment forms, search) and discovers real content through the REST API, so you can write readable Gherkin scenarios against the main pages of any WordPress site without hand-rolling CSS selectors or hard-coding slugs.

The pack stays deliberately small: anything webship-js already covers — body classes, landmarks, status codes, element assertions — is used from the core pack rather than redefined here.

It is a **plugin for webship-js** — it does not run standalone. It ships one file of step definitions plus example `.feature` files; you drop it into an existing (or new) webship-js test project.

## What's covered

- **The public site:** front page, pages, posts, category archives, the 404 page, the site title and the comment form.
- **Search:** open the results for a term, use the search form, assert that results exist or that none were found, and that a result lists an entry.
- **Sessions and accounts:** the login screen and its error and message notices, login by a handle from the users registry (no password in a feature file), explicit credentials, logout the way a user does, the lost password screen, "logged in as" checked on the server, the account's role, and the admin bar.
- **Roles and screens:** the administration screens by name (`Given I am on the "Plugins" admin screen`), the landing screen of each role, and the access denied screen a role without the capability gets.
- **The administration area:** the dashboard and its widgets, the admin menu and its submenus, the admin bar, notices (success, error, warning, info), the plugins and themes screens (installed, active, activate and deactivate a plugin, block or classic theme), settings (site title and any labelled setting, the permalink structure), Site Health tests, and the cron endpoint.
- **Content in the block editor:** new post or page, open an entry by title, set the title, write a paragraph, publish, update, save a draft, submit for review (contributor), move to the trash, restore, delete permanently, the status of an entry, what the editor offers each role; categories and tags (add, delete, file a post, tag a post, assert on the public post); the media library (upload, list, delete).

Each step is documented with a JSDoc block and Gherkin examples in [`tests/step-definitions/`](tests/step-definitions/): `wordpress.steps.js` (the public site), `wordpress-session.steps.js` (sessions, accounts, roles), `wordpress-admin.steps.js` (the administration area), `wordpress-content.steps.js` (the block editor, lists, categories, tags and media) and `wordpress-helpers.js` (shared helpers, no steps).

## Requirements

- Node.js >= 20
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

This repo's own [`tests/features/`](tests/features/) directory doubles as a working reference project for the `cucumber.js` setup above.

## Quick example

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

## Running this repo's own test suite

This repository is itself a working webship-js project — its `tests/features/*.feature` files run against whatever WordPress site `LAUNCH_URL` points to.

```bash
npm install
npx playwright install --with-deps chromium
LAUNCH_URL=https://your-site.example npm test   # runs against your own site
```

CI (`.github/workflows/test.yml`) doesn't depend on an external site: it spins up a default WordPress install on the runner with [DDEV](https://ddev.com/) and runs the suite against that. To do the same locally:

```bash
ddev config --project-type=wordpress --project-name=wordpress-steps --docroot=web --create-docroot
ddev start
ddev wp core download --path=web
ddev wp config create --path=web --dbname=db --dbuser=db --dbpass=db --dbhost=db --skip-check
ddev wp core install --path=web --url="https://wordpress-steps.ddev.site" \
  --title="wordpress-steps local" --admin_user=admin --admin_password=admin \
  --admin_email=admin@example.com --skip-email
for role in editor author contributor subscriber; do
  ddev wp user create "$role" "$role@example.com" --role="$role" --user_pass="$role" --path=web
done

LAUNCH_URL=https://wordpress-steps.ddev.site npm test
```

Other scripts:

| Script | Effect |
| --- | --- |
| `npm test` | Full suite, pretty output |
| `npm run test:dry` | `--dry-run` — checks for undefined/ambiguous steps only |
| `npm run test:examples` | No browser: every step's JSDoc carries five `Example #n:` lines that match its own definition and no other, and every feature step resolves to exactly one definition (also runs in CI) |
| `npm run test:headed` | Headed browser |
| `npm run test:chromium` / `test:firefox` / `test:webkit` | Pick a browser |

## Contributing

Issues and pull requests are tracked on GitHub. `2.0.x` is the repository's single active branch.

## License

MIT © Webship.co — see [LICENSE](LICENSE).

### Lanes, subsets and the settings webship-js reads

- `FEATURES=tests/features/a.feature,tests/features/b.feature npm test` runs a subset of the feature files; `CUCUMBER_TAGS=@critical npm test` runs a tag lane (the default run leaves `@wip` out).
- `cucumber.js` carries the `video` block (`WEBSHIP_VIDEO=on-failure` records the browser) and the `javascript` block (`WEBSHIP_JS_ERROR_MODE=fail` fails a scenario on a JavaScript error; `@js-off` silences one scenario) that webship-js reads.
- The step timeout is webship-js's own (45 seconds, set when it loads); `WEBSHIP_STEP_TIMEOUT=<milliseconds>` changes it, a `timeout` key in `cucumber.js` does not.
