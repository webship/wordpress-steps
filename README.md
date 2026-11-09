# wordpress-steps

[![Test](https://github.com/webship/wordpress-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/wordpress-steps/actions/workflows/test.yml)

WordPress-specific Cucumber step definitions for [webship-js](https://www.npmjs.com/package/webship-js) — a Playwright + Cucumber BDD testing framework. `@webship-js/wordpress-steps` adds a `wordpress.steps.js` step-pack that understands WordPress's own markup conventions (`#wpadminbar`, `#loginform`, `.site-title`, comment forms, search) and discovers real content through the REST API, so you can write readable Gherkin scenarios against the main pages of any WordPress site without hand-rolling CSS selectors or hard-coding slugs.

The pack stays deliberately small: anything webship-js already covers — body classes, landmarks, status codes, element assertions — is used from the core pack rather than redefined here.

It is a **plugin for webship-js** — it does not run standalone. It ships one file of step definitions plus example `.feature` files; you drop it into an existing (or new) webship-js test project.

## What's covered

- Homepage / front page
- Static pages (`page` post type)
- Single blog posts (`post` post type)
- Category / taxonomy archives
- Site search
- 404 error page
- `wp-login.php` login form + authentication
- Site title, admin toolbar, comment form

See [`tests/step-definitions/wordpress.steps.js`](tests/step-definitions/wordpress.steps.js) for the full list of steps — each is documented with a JSDoc block and Gherkin examples.

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
      // Named accounts for "Given I am a logged in user with the username ...".
      users: {
        admin: {
          username: process.env.WP_ADMIN_USER || 'admin',
          password: process.env.WP_ADMIN_PASSWORD || 'admin',
        },
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

LAUNCH_URL=https://wordpress-steps.ddev.site npm test
```

Other scripts:

| Script | Effect |
| --- | --- |
| `npm test` | Full suite, pretty output |
| `npm run test:dry` | `--dry-run` — checks for undefined/ambiguous steps only |
| `npm run test:headed` | Headed browser |
| `npm run test:chromium` / `test:firefox` / `test:webkit` | Pick a browser |

## Contributing

Issues and pull requests are tracked on GitHub. `2.0.x` is the repository's single active branch.

## License

MIT © Webship.co — see [LICENSE](LICENSE).
