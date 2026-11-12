// A registry entry: the username and password default to the handle itself.
function account(handle) {
  const key = 'WP_' + handle.toUpperCase();
  return {
    username: process.env[key + '_USER'] || handle,
    password: process.env[key + '_PASSWORD'] || handle,
  };
}

module.exports = {
  default: {
    // The step timeout is webship-js's (45 s, set when it loads): WEBSHIP_STEP_TIMEOUT=<milliseconds> changes it; a `timeout` key here is ignored.
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    // FEATURES=tests/features/a.feature,tests/features/b.feature runs a subset.
    paths: process.env.FEATURES ? process.env.FEATURES.split(',') : ['tests/features/**/*.feature'],
    // CUCUMBER_TAGS=@critical runs a lane; the default keeps work-in-progress and auth-state setup out.
    tags: process.env.CUCUMBER_TAGS || 'not @wip and not @auth-setup',
    format: [
      '@cucumber/pretty-formatter',
      'json:tests/reports/cucumber_report.json',
    ],
    formatOptions: {
      theme: {
        'feature keyword': ['bold', 'blue'],
        'feature name': ['blue', 'underline'],
        'feature description': ['blueBright'],
        'scenario keyword': ['bold', 'magenta'],
        'scenario name': ['magenta', 'underline'],
        'step keyword': ['bold', 'green'],
        'step text': ['greenBright', 'italic'],
      },
    },
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://wptest.io',
      // Video of the browser: 'off', 'on', 'on-failure' or 'tag' (scenarios tagged @video; @no-video opts out).
      video: { mode: process.env.WEBSHIP_VIDEO || 'off', dir: './videos', size: { width: 1280, height: 720 }, filenamePattern: '{datetime}.{feature_file}.{scenario}.{status}.{ext}' },
      // JavaScript errors the page raises: 'warn' reports them, 'fail' fails the scenario, 'off' ignores them; @js-fail, @js-warn and @js-off per scenario.
      javascript: { mode: process.env.WEBSHIP_JS_ERROR_MODE || 'warn', levels: ['error'], ignore: '', beforeScenario: false, afterScenario: true },
      // The users registry: a handle a feature can read, mapped to a real account.
      // Keeps passwords out of feature files; override per environment with
      // WP_<HANDLE>_USER and WP_<HANDLE>_PASSWORD, for example WP_ADMIN_USER.
      // Accounts are configuration, created once on the site (`wp user create`);
      // a feature never creates or deletes one.
      users: {
        admin: account('admin'),
        editor: account('editor'),
        author: account('author'),
        contributor: account('contributor'),
        subscriber: account('subscriber'),
      },
      minWaitTime: {
        page: 3000,
        before_scenario: 0,
        after_scenario: 0,
        before_step: 0,
        after_step: 0,
      },
    },
  },
};
