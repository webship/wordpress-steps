'use strict';

// WordPress step definitions for webship-js: the administration area.
//
// The dashboard and its widgets, the admin menu and the admin bar, the notices
// every screen shows, the plugins and themes screens, the settings screens,
// Site Health and the cron endpoint. Screens are opened by name with
// `Given I am on the "Plugins" admin screen` (see wordpress-session.steps.js).

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  expectText,
  expectRendered,
  adminScreenPath,
  restRequest,
  supplied,
  WAIT_TIMEOUT,
} = require('./wordpress-helpers');

// ---------------------------------------------------------------------------
// Dashboard, admin menu and admin bar
// ---------------------------------------------------------------------------

/**
 * Assert a dashboard widget is on the Dashboard, by its title: "At a Glance",
 * "Activity", "Quick Draft", "Site Health Status", "WordPress Events and
 * News". The Dashboard must be open: it is where a role lands after login.
 *
 * Example #1: Then I should see the "At a Glance" dashboard widget
 * Example #2: And we should see the "Activity" dashboard widget
 * Example #3: Then I should not see the "Quick Draft" dashboard widget
 * Example #4: And I should see the "Site Health Status" dashboard widget
 * Example #5: But we should not see the "Plugins" dashboard widget
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)" dashboard widget$/, async function (pronounCase, notCase, title) {
  const widgets = this.page.locator('#dashboard-widgets .postbox .postbox-header h2, #dashboard-widgets .postbox h2.hndle');
  await expectText(widgets, title, notCase, {
    label: 'the dashboard widget titles',
    hint: 'Open the Dashboard first (Given I am on the "Dashboard" admin screen). Roles see different widgets, and a user can hide one under Screen Options.',
    timeout: budget(this),
  });
});

// The top-level admin menu entry whose label contains `label`.
function menuEntry(page, label) {
  return page.locator('#adminmenu > li.menu-top').filter({ has: page.locator('a.menu-top .wp-menu-name', { hasText: label }) }).first();
}

/**
 * Assert the admin menu has, or does not have, a top-level entry. The match is
 * a substring of the label, so a count bubble ("Plugins 2") does not matter.
 * The menu shows what the role may use.
 *
 * Example #1: Then the admin menu should list "Posts"
 * Example #2: And the admin menu should list "Plugins"
 * Example #3: Then the admin menu should not list "Plugins"
 * Example #4: And the admin menu should not list "Users"
 * Example #5: Then the admin menu should list "Settings"
 *
 */
Then(/^the admin menu should( not)* list "([^"]*)"$/, async function (notCase, label) {
  await expectRendered(this.page.locator('#adminmenu'), false, {
    label: 'the admin menu ("#adminmenu")',
    hint: 'Open an administration screen first: Given I am on the "Dashboard" admin screen.',
  });
  await expectRendered(menuEntry(this.page, label), notCase, {
    label: `the admin menu entry "${label}"`,
    hint: 'The menu lists only what the logged-in role may use; plugins add and remove entries.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Assert a submenu has, or does not have, an entry: the links under a top-level
 * item such as Settings (General, Writing, Reading, Discussion, Media,
 * Permalinks, Privacy) or Posts (All Posts, Add Post, Categories, Tags).
 *
 * Example #1: Then the "Settings" admin submenu should list "Permalinks"
 * Example #2: And the "Posts" admin submenu should list "Categories"
 * Example #3: Then the "Tools" admin submenu should list "Site Health"
 * Example #4: And the "Settings" admin submenu should not list "Hello"
 * Example #5: Then the "Users" admin submenu should list "Profile"
 *
 */
Then(/^the "([^"]*)" admin submenu should( not)* list "([^"]*)"$/, async function (menu, notCase, label) {
  await expectRendered(menuEntry(this.page, menu), false, {
    label: `the admin menu entry "${menu}"`,
    hint: 'Open an administration screen first, with an account that may see this menu.',
    presenceOnly: true,
    timeout: budget(this),
  });
  await expectRendered(menuEntry(this.page, menu).locator('.wp-submenu a', { hasText: label }).first(), notCase, {
    label: `the "${menu}" submenu entry "${label}"`,
    hint: 'Submenus differ by role and by the plugins and theme in use.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Follow a top-level entry of the admin menu.
 *
 * Example #1: When I click "Posts" in the admin menu
 * Example #2: When we click "Plugins" in the admin menu
 * Example #3: And I click "Media" in the admin menu
 * Example #4: When I click "Users" in the admin menu
 * Example #5: And we click "Settings" in the admin menu
 *
 */
When(/^(I |we )*click "([^"]*)" in the admin menu$/, async function (pronounCase, label) {
  const link = menuEntry(this.page, label).locator('a.menu-top').first();
  await expectRendered(link, false, { label: `the admin menu entry "${label}"`, hint: 'Open an administration screen first, with an account that may see this menu.', timeout: budget(this) });
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), link.click()]);
  await settle(this);
});

/**
 * Follow a submenu entry of the admin menu: the menu is opened by pointing at
 * its top-level entry, as a user does.
 *
 * Example #1: When I click "Permalinks" under "Settings" in the admin menu
 * Example #2: When we click "Categories" under "Posts" in the admin menu
 * Example #3: And I click "Site Health" under "Tools" in the admin menu
 * Example #4: When I click "Add Post" under "Posts" in the admin menu
 * Example #5: And we click "Profile" under "Users" in the admin menu
 *
 */
When(/^(I |we )*click "([^"]*)" under "([^"]*)" in the admin menu$/, async function (pronounCase, label, menu) {
  const entry = menuEntry(this.page, menu);
  await expectRendered(entry, false, { label: `the admin menu entry "${menu}"`, hint: 'Open an administration screen first, with an account that may see this menu.', presenceOnly: true, timeout: budget(this) });
  await entry.hover();
  const link = entry.locator('.wp-submenu a', { hasText: label }).first();
  await expectRendered(link, false, { label: `the "${menu}" submenu entry "${label}"`, hint: 'Submenus differ by role and by the plugins and theme in use.', timeout: budget(this) });
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}), link.click()]);
  await settle(this);
});

/**
 * Assert the admin bar, the toolbar on top of the site and of the dashboard,
 * has, or does not have, an item. For a visitor who may edit, it offers "Edit
 * Post" or "Edit Page" on the entry being viewed.
 *
 * Example #1: Then the admin bar should list "Edit Post"
 * Example #2: And the admin bar should list "New"
 * Example #3: Then the admin bar should not list "Edit Page"
 * Example #4: And the admin bar should list "Dashboard"
 * Example #5: Then the admin bar should not list "Customize"
 *
 */
Then(/^the admin bar should( not)* list "([^"]*)"$/, async function (notCase, label) {
  await expectRendered(this.page.locator('#wpadminbar'), false, {
    label: 'the admin bar ("#wpadminbar")',
    hint: 'The admin bar renders only for a logged-in session that has not turned it off in the profile.',
  });
  await expectRendered(this.page.locator('#wpadminbar .ab-item', { hasText: label }).first(), notCase, {
    label: `the admin bar item "${label}"`,
    hint: 'The bar lists only what the role may do on this screen.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Follow an item of the admin bar, for example "Edit Post".
 *
 * Example #1: When I click "Edit Post" in the admin bar
 * Example #2: When we click "Dashboard" in the admin bar
 * Example #3: And I click "Visit Site" in the admin bar
 * Example #4: When I click "Edit Page" in the admin bar
 * Example #5: And we click "Edit Site" in the admin bar
 *
 */
When(/^(I |we )*click "([^"]*)" in the admin bar$/, async function (pronounCase, label) {
  const item = this.page.locator('#wpadminbar a.ab-item', { hasText: label }).first();
  await expectRendered(item, false, {
    label: `the admin bar item "${label}"`,
    hint: 'Log in as an account that may do this, and open a screen that offers it.',
    presenceOnly: true,
    timeout: budget(this),
  });
  // The item may sit in a menu that opens on hover; point at its parent first.
  await item.evaluate((element) => element.scrollIntoView());
  const href = await item.getAttribute('href');
  if (href) {
    await navigate(this, href);
  } else {
    await item.click();
    await settle(this);
  }
});

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------

const NOTICE_SELECTORS = {
  success: '#wpbody-content .notice-success, #wpbody-content div.updated',
  error: '#wpbody-content .notice-error, #wpbody-content div.error',
  warning: '#wpbody-content .notice-warning',
  info: '#wpbody-content .notice-info',
};

/**
 * Assert the screen shows, or does not show, an administration notice of a
 * kind, optionally containing a text. Notices are what a screen answers after
 * an action: "Settings saved.", "Plugin activated.", "1 post moved to the
 * Trash.". The kinds are success, error, warning and info.
 *
 * Example #1: Then I should see a success notice
 * Example #2: And we should see a success notice "Settings saved."
 * Example #3: Then I should see an error notice "could not"
 * Example #4: And I should not see an error notice
 * Example #5: But we should not see a warning notice "Update"
 *
 */
Then(/^(I |we )*should( not)* see an? (success|error|warning|info) notice(?: "([^"]*)")?$/, async function (pronounCase, notCase, kind, expectedText) {
  const notices = this.page.locator(NOTICE_SELECTORS[kind]).filter({ visible: true });
  const hint = 'Notices render at the top of an administration screen, after the action that caused them. A plugin may add its own.';
  if (notCase && !supplied(expectedText)) {
    await expectRendered(notices.first(), true, { label: `a ${kind} notice`, hint, presenceOnly: true, timeout: budget(this) });
    return;
  }
  await expectRendered(notices.first(), false, { label: `a ${kind} notice`, hint, presenceOnly: true, timeout: budget(this) });
  if (supplied(expectedText)) {
    await expectText(notices, expectedText, notCase, { label: `the ${kind} notices`, hint, timeout: budget(this) });
  }
});

// ---------------------------------------------------------------------------
// Plugins and themes
// ---------------------------------------------------------------------------

// The rows of a plugin on the Plugins screen, by the plugin's name.
function pluginRows(page, name) {
  return page.locator('tr[data-plugin]').filter({ has: page.locator('.plugin-title strong', { hasText: name }) });
}

/**
 * Assert a plugin is installed, active or inactive, as the Plugins screen
 * lists it. The plugin is named as the screen shows it.
 *
 * Example #1: Then the "Hello Dolly" plugin should be installed
 * Example #2: And the "Akismet Anti-spam: Spam Protection" plugin should be inactive
 * Example #3: Then the "Hello Dolly" plugin should be active
 * Example #4: And the "Some Plugin" plugin should not be installed
 * Example #5: Then the "Hello Dolly" plugin should not be active
 *
 */
Then(/^the "([^"]*)" plugin should( not)* be (installed|active|inactive)$/, async function (name, notCase, state) {
  await navigate(this, adminScreenPath('Plugins'));
  let rows = pluginRows(this.page, name);
  if (state !== 'installed') rows = rows.and(this.page.locator(state === 'active' ? 'tr.active' : 'tr.inactive'));
  await expectRendered(rows.first(), notCase, {
    label: `the plugin "${name}" (${state})`,
    hint: 'Name the plugin as the Plugins screen shows it. A must-use plugin is listed under its own tab and not here.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Activate or deactivate a plugin on the Plugins screen, with its row action.
 * WordPress answers with the notice "Plugin activated." or "Plugin
 * deactivated."
 *
 * Example #1: When I activate the "Hello Dolly" plugin
 * Example #2: When we deactivate the "Hello Dolly" plugin
 * Example #3: And I activate the "Akismet Anti-spam: Spam Protection" plugin
 * Example #4: When I deactivate the "Akismet Anti-spam: Spam Protection" plugin
 * Example #5: And we activate the "Hello Dolly" plugin
 *
 */
When(/^(I |we )*(activate|deactivate) the "([^"]*)" plugin$/, async function (pronounCase, action, name) {
  await navigate(this, adminScreenPath('Plugins'));
  const row = pluginRows(this.page, name).first();
  await expectRendered(row, false, {
    label: `the plugin "${name}"`,
    hint: 'Name the plugin as the Plugins screen shows it, and log in as an administrator.',
    timeout: budget(this),
  });
  const link = row.locator(`.row-actions .${action} a`).first();
  if (!(await link.count())) {
    throw friendly({
      message: `The plugin "${name}" has no "${action}" action.`,
      hint: action === 'activate' ? 'It is probably active already.' : 'It is probably inactive already.',
    });
  }
  await row.hover();
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}), link.click()]);
  await settle(this);
});

/**
 * Assert a theme is installed, or is the active theme, as the Themes screen
 * lists it. The theme is named as the screen shows it.
 *
 * Example #1: Then the "Twenty Twenty-Five" theme should be active
 * Example #2: And the "Twenty Twenty-Four" theme should be installed
 * Example #3: Then the "Twenty Twenty-Four" theme should not be active
 * Example #4: And the "Some Theme" theme should not be installed
 * Example #5: Then the "Twenty Twenty-Five" theme should be installed
 *
 */
Then(/^the "([^"]*)" theme should( not)* be (installed|active)$/, async function (name, notCase, state) {
  await navigate(this, adminScreenPath('Themes'));
  let theme = this.page.locator('.theme[data-slug]').filter({ has: this.page.locator('.theme-name', { hasText: name }) });
  if (state === 'active') theme = theme.and(this.page.locator('.theme.active'));
  await expectRendered(theme.first(), notCase, {
    label: `the theme "${name}" (${state})`,
    hint: 'Name the theme as the Themes screen shows it.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Assert the active theme is a block theme (with the Site Editor and block
 * templates) or a classic theme (with PHP templates, widget areas and menus).
 * It asks the REST API, as an administrator. It tells which screens exist:
 * Appearance > Editor and Navigation for a block theme, Widgets and Menus for
 * a classic theme.
 *
 * Example #1: Then the active theme should be a block theme
 * Example #2: And the active theme should be a block theme
 * Example #3: Then the active theme should not be a classic theme
 * Example #4: And the active theme should be a classic theme
 * Example #5: Then the active theme should not be a block theme
 *
 */
Then(/^the active theme should( not)* be a (block|classic) theme$/, async function (notCase, kind) {
  const result = await restRequest(this, '/wp/v2/themes?status=active');
  if (result.status !== 200 || !Array.isArray(result.json) || !result.json.length) {
    throw friendly({
      message: 'Could not read the active theme from the REST API.',
      cause: `the REST API answered ${result.status}`,
      hint: 'Log in as an administrator first: Given I am a logged in user with the "admin" user.',
    });
  }
  const isBlock = Boolean(result.json[0].is_block_theme);
  const actual = isBlock ? 'block' : 'classic';
  if ((actual === kind) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the active theme not to be a ${kind} theme.` : `Expected the active theme to be a ${kind} theme.`,
      cause: `the active theme "${result.json[0].stylesheet}" is a ${actual} theme`,
    });
  }
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Save the settings form of the screen that is open, with its "Save Changes"
 * button, and wait for WordPress's answer: the notice "Settings saved." or
 * "Permalink structure updated." It fails with the error notice when
 * WordPress shows one.
 *
 * Example #1: When I save the settings
 * Example #2: When we save the settings
 * Example #3: And I save the settings
 * Example #4: When we save the changes
 * Example #5: And I save the changes
 *
 */
When(/^(I |we )*save the (?:settings|changes)$/, async function (pronounCase) {
  const button = this.page.locator('#wpbody-content form input#submit, #wpbody-content form p.submit input[type="submit"]').first();
  await expectRendered(button, false, {
    label: 'the "Save Changes" button',
    hint: 'Open a settings screen first, for example: Given I am on the "General Settings" admin screen.',
  });
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}), button.click()]);
  await settle(this);
  const error = this.page.locator(NOTICE_SELECTORS.error).filter({ visible: true }).first();
  if (await error.count()) {
    throw friendly({
      message: 'WordPress refused to save the settings.',
      cause: ((await error.textContent()) || '').replace(/\s+/g, ' ').trim(),
    });
  }
});

// The form control of a settings field, found by its label.
function settingField(page, label) {
  return page.locator('#wpbody-content form').getByLabel(label, { exact: true }).first();
}

/**
 * Assert a field on the open settings screen holds a value, by its label:
 * "Site Title", "Tagline", "Administration Email Address", "New User Default
 * Role" and the others of Settings > General, Reading and Discussion.
 *
 * Example #1: Then the "Site Title" setting should be "My Site"
 * Example #2: And the "Tagline" setting should be "Just another site"
 * Example #3: Then the "Site Title" setting should not be "Other"
 * Example #4: And the "New User Default Role" setting should be "subscriber"
 * Example #5: Then the "Tagline" setting should not be "Old tagline"
 *
 */
Then(/^the "([^"]*)" setting should( not)* be "([^"]*)"$/, async function (label, notCase, expected) {
  const field = settingField(this.page, label);
  await expectRendered(field, false, {
    label: `the setting "${label}"`,
    hint: 'Open the settings screen that has it first, and use the label as the screen shows it.',
    timeout: budget(this),
  });
  const actual = await field.inputValue();
  if ((actual === expected) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the setting "${label}" not to be "${expected}".` : `Expected the setting "${label}" to be "${expected}".`,
      cause: `it is "${actual}"`,
    });
  }
});

/**
 * Change a setting on the open settings screen, by its label, without saving.
 * Follow it with "I save the settings". A select takes the option's value or
 * its text.
 *
 * Example #1: When I change the "Site Title" setting to "My Site"
 * Example #2: When we change the "Tagline" setting to "A new tagline"
 * Example #3: And I change the "Site Title" setting to "Webship"
 * Example #4: When I change the "New User Default Role" setting to "Subscriber"
 * Example #5: And we change the "Tagline" setting to ""
 *
 */
When(/^(I |we )*change the "([^"]*)" setting to "([^"]*)"$/, async function (pronounCase, label, value) {
  const field = settingField(this.page, label);
  await expectRendered(field, false, {
    label: `the setting "${label}"`,
    hint: 'Open the settings screen that has it first, and use the label as the screen shows it.',
    timeout: budget(this),
  });
  const tag = await field.evaluate((element) => element.tagName);
  // The first value a setting had in this scenario, for "I restore the ... setting".
  this.settingsBefore = this.settingsBefore || {};
  if (!(label in this.settingsBefore)) this.settingsBefore[label] = await field.inputValue();
  if (tag === 'SELECT') {
    await field.selectOption(value);
  } else {
    await field.fill(value || '');
  }
});

/**
 * Put a setting back to the value it had before the first "I change the ...
 * setting to ..." of the scenario, on the screen that is open. Follow it with
 * "I save the settings". Use it at the end of a scenario that changed a
 * setting, so the site is left as it was found.
 *
 * Example #1: When I restore the "Site Title" setting
 * Example #2: When we restore the "Tagline" setting
 * Example #3: And I restore the "Site Title" setting
 * Example #4: When I restore the "New User Default Role" setting
 * Example #5: And we restore the "Tagline" setting
 *
 */
When(/^(I |we )*restore the "([^"]*)" setting$/, async function (pronounCase, label) {
  const before = this.settingsBefore && this.settingsBefore[label];
  if (before === undefined) {
    throw friendly({
      message: `There is no earlier value of the setting "${label}" to restore.`,
      hint: 'Run "When I change the ... setting to ..." first, in the same scenario.',
    });
  }
  const field = settingField(this.page, label);
  await expectRendered(field, false, { label: `the setting "${label}"`, hint: 'Open the screen that has it first.', timeout: budget(this) });
  if ((await field.evaluate((element) => element.tagName)) === 'SELECT') await field.selectOption(before);
  else await field.fill(before);
});

// The radio of a permalink structure, by the label the screen gives it.
function permalinkRadio(page, name) {
  return page.locator('.structure-selection').getByLabel(name, { exact: true }).first();
}

/**
 * Choose a permalink structure on Settings > Permalinks, by the name the
 * screen gives it: Plain, Day and name, Month and name, Numeric, Post name.
 * Follow it with "I save the settings". The structure before the change is
 * remembered for "I restore the permalink structure".
 *
 * Example #1: When I choose the "Post name" permalink structure
 * Example #2: When we choose the "Day and name" permalink structure
 * Example #3: And I choose the "Plain" permalink structure
 * Example #4: When I choose the "Numeric" permalink structure
 * Example #5: And we choose the "Month and name" permalink structure
 *
 */
When(/^(I |we )*choose the "([^"]*)" permalink structure$/, async function (pronounCase, name) {
  await navigate(this, adminScreenPath('Permalinks'));
  const radios = this.page.locator('input[name="selection"]');
  await expectRendered(radios.first(), false, { label: 'the permalink structure choices', hint: 'Log in as an administrator.' });
  this.permalinkBefore = await currentPermalinkName(this.page);
  const wanted = permalinkRadio(this.page, name);
  if (!(await wanted.count())) {
    throw friendly({
      message: `The permalink structure "${name}" is not offered.`,
      hint: 'Use the names on Settings > Permalinks: Plain, Day and name, Month and name, Numeric, Post name.',
    });
  }
  await wanted.check();
  await settle(this);
});

// The label of the permalink structure that is selected on the open screen.
async function currentPermalinkName(page) {
  return page.locator('.structure-selection input[name="selection"]:checked').first().evaluate((input) => {
    const label = document.querySelector(`label[for="${input.id}"]`);
    return (label ? label.textContent : '').replace(/\s+/g, ' ').trim();
  });
}

/**
 * Restore the permalink structure that was selected before the last "I choose
 * the ... permalink structure", and save it. Use it at the end of a scenario
 * that changed it.
 *
 * Example #1: When I restore the permalink structure
 * Example #2: When we restore the permalink structure
 * Example #3: And I restore the permalink structure
 * Example #4: Then we restore the permalink structure
 * Example #5: And we restore the permalink structure
 *
 */
When(/^(I |we )*restore the permalink structure$/, async function (pronounCase) {
  if (!this.permalinkBefore) {
    throw friendly({
      message: 'There is no earlier permalink structure to restore.',
      hint: 'Run "When I choose the ... permalink structure" first, in the same scenario.',
    });
  }
  await navigate(this, adminScreenPath('Permalinks'));
  await permalinkRadio(this.page, this.permalinkBefore).check();
  const button = this.page.locator('#wpbody-content form p.submit input[type="submit"], #wpbody-content form input#submit').first();
  await Promise.all([this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}), button.click()]);
  await settle(this);
});

/**
 * Assert the permalink structure selected on Settings > Permalinks, by its
 * name.
 *
 * Example #1: Then the permalink structure should be "Post name"
 * Example #2: And the permalink structure should be "Day and name"
 * Example #3: Then the permalink structure should not be "Plain"
 * Example #4: And the permalink structure should not be "Numeric"
 * Example #5: Then the permalink structure should be "Month and name"
 *
 */
Then(/^the permalink structure should( not)* be "([^"]*)"$/, async function (notCase, name) {
  await navigate(this, adminScreenPath('Permalinks'));
  const actual = await currentPermalinkName(this.page);
  if ((actual === name) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the permalink structure not to be "${name}".` : `Expected the permalink structure to be "${name}".`,
      cause: `it is "${actual}"`,
    });
  }
});

// ---------------------------------------------------------------------------
// Site Health and cron
// ---------------------------------------------------------------------------

const HEALTH_SECTIONS = {
  pass: '#health-check-site-status-good',
  recommended: '#health-check-site-status-recommended',
  critical: '#health-check-site-status-critical',
};

/**
 * Assert a Site Health test has a result, by the title the screen gives it:
 * passed, recommended (should be improved) or critical. Site Health runs its
 * tests in the page, so the step waits for them. The Site Health screen must
 * be open. Tests that matter for operation include "Scheduled events are
 * running" (cron), "The REST API is available", "Your site can perform
 * loopback requests" and "Your website is using an active HTTPS connection".
 *
 * Example #1: Then the site health test "Scheduled events are running" should pass
 * Example #2: And the site health test "The REST API is available" should pass
 * Example #3: Then the site health test "You should remove inactive plugins" should be recommended
 * Example #4: And the site health test "Your site is set to display errors to site visitors" should be critical
 * Example #5: Then the site health test "Search engine indexing is enabled." should pass
 *
 */
Then(/^the site health test "([^"]*)" should (pass|be recommended|be critical)$/, async function (title, result) {
  const kind = result === 'pass' ? 'pass' : result === 'be recommended' ? 'recommended' : 'critical';
  const anyTest = this.page.locator('.health-check-accordion-trigger .title');
  try {
    await anyTest.first().waitFor({ state: 'attached', timeout: WAIT_TIMEOUT });
  } catch (err) {
    throw friendly({
      message: 'Site Health showed no test results.',
      cause: err,
      hint: 'Open the screen first: Given I am on the "Site Health" admin screen. The tests run in the page and need an administrator.',
    });
  }
  const wanted = this.page.locator(`${HEALTH_SECTIONS[kind]} .health-check-accordion-trigger .title`, { hasText: title });
  try {
    await wanted.first().waitFor({ state: 'attached', timeout: 10000 });
  } catch (err) {
    const others = Object.entries(HEALTH_SECTIONS).filter(([name]) => name !== kind);
    let found = '';
    for (const [name, selector] of others) {
      if (await this.page.locator(`${selector} .health-check-accordion-trigger .title`, { hasText: title }).count()) found = name === 'pass' ? 'passed' : name;
    }
    throw friendly({
      message: `Expected the site health test "${title}" to ${result}.`,
      cause: found ? `it is listed as ${found}` : 'no test has this title',
      hint: 'Use the title as Site Health shows it; the list depends on the WordPress version and the site.',
    });
  }
});

/**
 * Assert the WordPress cron endpoint, `wp-cron.php`, answers without error.
 * It runs the scheduled events that are due, so a fatal error in a plugin's
 * event shows here. A site that runs cron from the system still answers.
 *
 * Example #1: Then the WordPress cron should respond
 * Example #2: And the WordPress cron should respond
 * Example #3: Then the scheduled tasks should respond
 * Example #4: And the cron should respond
 * Example #5: Then the WordPress cron should respond without errors
 *
 */
Then(/^the (?:WordPress cron|scheduled tasks|cron) should respond(?: without errors)?$/, async function () {
  const response = await this.context.request.get(this.launchUrl.replace(/\/+$/, '') + '/wp-cron.php?doing_wp_cron', { failOnStatusCode: false, timeout: 30000 });
  const body = await response.text();
  if (response.status() !== 200 || /fatal error|parse error|<b>Warning<\/b>/i.test(body)) {
    throw friendly({
      message: 'The WordPress cron endpoint did not answer cleanly.',
      cause: `status ${response.status()}${body ? `, body "${body.replace(/\s+/g, ' ').slice(0, 160)}"` : ''}`,
      hint: 'wp-cron.php must be reachable from the test runner, and a plugin\'s scheduled event must not raise an error.',
    });
  }
});
