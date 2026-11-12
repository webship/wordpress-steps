'use strict';

// WordPress step definitions for webship-js: sessions and accounts.
//
// Login by handle from `worldParameters.users` (no password in a feature file),
// logout, the login screen and its notices, the account's role, and the
// administration screens a role lands on or is refused.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  siteRoot,
  navigate,
  expectText,
  expectRendered,
  resolveUser,
  endSession,
  openLogin,
  submitLogin,
  loginAs,
  isLoggedIn,
  adminScreenPath,
  restRequest,
  supplied,
} = require('./wordpress-helpers');

// ---------------------------------------------------------------------------
// The login screen
// ---------------------------------------------------------------------------

/**
 * Open the core login screen, `/wp-login.php`.
 *
 * Example #1: Given I am on the login page
 * Example #2: Given we are on the sign in page
 * Example #3: And on the login page
 * Example #4: Given we are on the sign-in page
 * Example #5: And I am on the signin page
 *
 */
Given(/^(I am |we are )*on the (?:sign[- ]?in|login) page$/, async function (pronounCase) {
  await openLogin(this);
});

/**
 * Assert the login form, its username field and its password field are
 * rendered. Each is checked separately, so a failure names the missing one.
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
 * Assert the login screen shows, or does not show, its error notice
 * (`#login_error`), optionally containing a text such as "incorrect" or
 * "not registered". A wrong password, an unknown user and an empty form each
 * produce it.
 *
 * Example #1: Then I should see a login error
 * Example #2: And we should see a sign-in error message
 * Example #3: Then should see a login error "incorrect"
 * Example #4: Then I should not see a login error
 * Example #5: But we should not see an error message "incorrect"
 *
 */
Then(/^(I |we )*should( not)* see an? (?:login |sign[- ]?in )?error(?: message)?(?: "([^"]*)")?$/, async function (pronounCase, notCase, expectedText) {
  const notice = this.page.locator('#login_error').first();
  const hint = 'The core login screen renders the notice above the form; a security plugin may replace or suppress it.';
  if (notCase && !expectedText) {
    await expectRendered(notice, true, { label: 'the login error notice ("#login_error")', hint, timeout: budget(this) });
    return;
  }
  await expectRendered(notice, false, { label: 'the login error notice ("#login_error")', hint, timeout: budget(this) });
  if (expectedText) {
    await expectText(notice, expectedText, notCase, { label: 'the login error notice', hint, timeout: budget(this) });
  }
});

/**
 * Assert the login screen shows, or does not show, an informational message
 * (`#login .message`), optionally containing a text. WordPress uses it for
 * "You are now logged out." and "Check your email for the confirmation link."
 *
 * Example #1: Then I should see a login message
 * Example #2: And we should see a login message "logged out"
 * Example #3: Then should see a sign-in message "Check your email"
 * Example #4: Then I should not see a login message
 * Example #5: But we should not see a login message "logged out"
 *
 */
Then(/^(I |we )*should( not)* see an? (?:login|sign[- ]?in) message(?: "([^"]*)")?$/, async function (pronounCase, notCase, expectedText) {
  const message = this.page.locator('#login .message').first();
  const hint = 'WordPress shows this message after logging out or requesting a password reset; a plugin may replace the core login screen.';
  if (notCase && !expectedText) {
    await expectRendered(message, true, { label: 'the login message ("#login .message")', hint, timeout: budget(this) });
    return;
  }
  await expectRendered(message, false, { label: 'the login message ("#login .message")', hint, timeout: budget(this) });
  if (expectedText) {
    await expectText(message, expectedText, notCase, { label: 'the login message', hint, timeout: budget(this) });
  }
});

/**
 * Log in with explicit credentials, for scenarios where the credentials are
 * the subject. The login screen must be open already.
 *
 * Example #1: When I log in as "admin" with password "secret"
 * Example #2: When we sign in as "editor" with password "p@ssw0rd"
 * Example #3: And log in as "author" with password "letmein"
 * Example #4: And we log in as "reviewer" with password "hunter2"
 * Example #5: When I sign in as "admin" with password "wrong-password"
 *
 */
When(/^(I |we )*(?:log in|sign in) as "([^"]*)?" with password "([^"]*)?"$/, async function (pronounCase, username, password) {
  await submitLogin(this, username || '', password || '');
});

/**
 * Log in as a configured account, with another password: the handle gives the
 * username, so the feature file names no account either. The login screen must
 * be open already. Use it for a wrong password.
 *
 * Example #1: When I log in as the "admin" user with password "not-the-password"
 * Example #2: When we sign in as the "editor" user with password "wrong"
 * Example #3: And log in as the "subscriber" user with password "wrong-password"
 * Example #4: When I log in as the "author" user with password ""
 * Example #5: And we sign in as the "contributor" user with password "nope"
 *
 */
When(/^(I |we )*(?:log in|sign in) as the "([^"]*)" user with password "([^"]*)?"$/, async function (pronounCase, handle, password) {
  const account = resolveUser(this, handle);
  await submitLogin(this, account.username, password || '');
});

/**
 * Open the lost password screen.
 *
 * Example #1: Given I am on the lost password page
 * Example #2: Given we are on the lost password page
 * Example #3: And on the lost password page
 * Example #4: Given we are on the reset password page
 * Example #5: And I am on the forgot password screen
 *
 */
Given(/^(I am |we are )*on the (?:lost|forgot|reset) password (?:page|screen)$/, async function (pronounCase) {
  await navigate(this, '/wp-login.php?action=lostpassword');
  await expectRendered(this.page.locator('#lostpasswordform'), false, {
    label: 'the lost password form ("#lostpasswordform")',
    hint: 'A plugin may have replaced the core password reset screen, or password resets are turned off.',
  });
});

/**
 * Request a password reset for a configured account, from the lost password
 * screen. WordPress answers with "Check your email for the confirmation link."
 * and sends the mail; the account is looked up by its handle.
 *
 * Example #1: When I request a password reset for the "subscriber" user
 * Example #2: When we request a password reset for the "editor" user
 * Example #3: And request a password reset for the "author" user
 * Example #4: When I request a password reset for the "admin" user
 * Example #5: And we request a password reset for the "contributor" user
 *
 */
When(/^(I |we )*request a password reset for the "([^"]*)" user$/, async function (pronounCase, handle) {
  const account = resolveUser(this, handle);
  const form = this.page.locator('#lostpasswordform');
  await expectRendered(form, false, {
    label: 'the lost password form ("#lostpasswordform")',
    hint: 'Run first: Given I am on the lost password page.',
    timeout: 5000,
  });
  await form.locator('#user_login').fill(account.username);
  await Promise.all([
    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    form.evaluate((element) => element.requestSubmit()),
  ]);
  await settle(this);
});

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Log in as an account from the users registry, `worldParameters.users` in
 * `cucumber.js`, so no password appears in a feature file. The handle is the
 * registry key ("admin", "editor", "author", "contributor", "subscriber"). It
 * opens the login screen, submits the form and fails with the screen's own
 * message when WordPress refuses the credentials.
 *
 * Example #1: Given I am a logged in user with the "admin" user
 * Example #2: Given we are a logged in user with username "editor"
 * Example #3: Given I am a logged in user with "author"
 * Example #4: And a logged in user with the username "admin"
 * Example #5: Given I am a logged in user with the username "subscriber" user
 *
 */
Given(/^(I am |we are )*a logged in user with( the)*( username)* "([^"]*)?"( user)*$/, async function (pronounCase, theCase, usernameCase, handle, userCase) {
  this.currentUserHandle = handle;
  await loginAs(this, handle);
});

/**
 * End any authenticated session and land on the login screen as a visitor:
 * cookies and web storage are cleared, the login page is opened and the core
 * login form is confirmed. Use it at the start of a scenario that must run
 * anonymously after an earlier one logged in. To end a session the way a user
 * does, use "I log out".
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given not logged in
 * Example #5: But I am not logged in
 *
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  try {
    await this.page.evaluate(() => {
      try { localStorage.clear(); } catch { /* storage may be unavailable */ }
      try { sessionStorage.clear(); } catch { /* storage may be unavailable */ }
    });
  } catch { /* the page may not be on a real URL yet */ }
  await endSession(this);
  this.currentUserHandle = null;
  await openLogin(this);
});

/**
 * Log out the way a user does: the "Log Out" link of the admin bar, which
 * carries the nonce WordPress asks for. Without an admin bar on the page it
 * opens `/wp-login.php?action=logout` and confirms. It ends on the login
 * screen with "You are now logged out."
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I sign out
 * Example #4: When we sign out
 * Example #5: And log out
 *
 */
When(/^(I |we )*(?:log|sign) out$/, async function (pronounCase) {
  let link = this.page.locator('#wp-admin-bar-logout a');
  if (!(await link.count())) {
    await navigate(this, '/wp-admin/');
    link = this.page.locator('#wp-admin-bar-logout a');
  }
  if (await link.count()) {
    await navigate(this, await link.first().getAttribute('href'));
  } else {
    // No admin bar: WordPress asks to confirm a logout that has no nonce.
    await navigate(this, '/wp-login.php?action=logout');
    const confirm = this.page.locator('#login a[href*="action=logout"]');
    if (await confirm.count()) await navigate(this, await confirm.first().getAttribute('href'));
  }
  this.currentUserHandle = null;
  if (await isLoggedIn(this)) {
    throw friendly({
      message: 'Logging out did not end the session.',
      hint: 'A plugin that keeps its own session (single sign-on) may need its own logout.',
    });
  }
});

/**
 * Assert the browser session is authenticated, or not, as the server sees it
 * (not by the admin bar or a cookie). With "as the ... user" it also checks
 * that the session is that registry account.
 *
 * Example #1: Then I should be logged in
 * Example #2: And we should be logged in
 * Example #3: Then I should not be logged in
 * Example #4: And I should be logged in as the "editor" user
 * Example #5: Then we should be logged in as the "admin" user
 *
 */
Then(/^(I |we )*should( not)* be logged in(?: as the "([^"]*)" user)?$/, async function (pronounCase, notCase, handle) {
  const loggedIn = await isLoggedIn(this);
  if (notCase) {
    if (supplied(handle)) {
      throw friendly({ message: 'A negative step cannot name a user.', hint: 'Use: Then I should not be logged in.' });
    }
    if (loggedIn) {
      throw friendly({
        message: 'Expected the session to be anonymous, but it is logged in.',
        hint: 'Run "Given I am not logged in" or "When I log out" first.',
      });
    }
    return;
  }
  if (!loggedIn) {
    throw friendly({
      message: 'Expected the session to be logged in, but it is anonymous.',
      hint: 'Log in first: Given I am a logged in user with the "admin" user.',
    });
  }
  if (supplied(handle)) {
    const account = resolveUser(this, handle);
    const me = await restRequest(this, '/wp/v2/users/me?context=edit');
    if (me.status !== 200 || !me.json || me.json.username !== account.username) {
      throw friendly({
        message: `Expected to be logged in as "${account.username}" (the "${handle}" user).`,
        cause: me.status === 200 && me.json ? `the session belongs to "${me.json.username}"` : `the REST API answered ${me.status}`,
        hint: 'Log in with "Given I am a logged in user with the ... user" before this step.',
      });
    }
  }
});

/**
 * Assert the logged-in account has, or does not have, a role. The role is its
 * slug: administrator, editor, author, contributor, subscriber, or one a
 * plugin adds.
 *
 * Example #1: Then my account should have the "editor" role
 * Example #2: And my account should have the "administrator" role
 * Example #3: Then my account should not have the "administrator" role
 * Example #4: And my account should not have the "editor" role
 * Example #5: Then my account should have the "subscriber" role
 *
 */
Then(/^my account should( not)* have the "([^"]*)" role$/, async function (notCase, role) {
  const me = await restRequest(this, '/wp/v2/users/me?context=edit');
  if (me.status !== 200 || !me.json) {
    throw friendly({
      message: 'Could not read the roles of the logged-in account.',
      cause: `the REST API answered ${me.status}`,
      hint: 'Log in first: Given I am a logged in user with the "editor" user.',
    });
  }
  const roles = me.json.roles || [];
  if (roles.includes(role) === Boolean(notCase)) {
    throw friendly({
      message: notCase
        ? `Expected the account not to have the "${role}" role.`
        : `Expected the account to have the "${role}" role.`,
      cause: `its roles are: ${roles.join(', ') || '(none)'}`,
    });
  }
});

/**
 * Assert the admin bar shows the account's display name in its account menu.
 *
 * Example #1: Then the admin bar should show the account "webmaster"
 * Example #2: And the admin bar should show the account "Jane Editor"
 * Example #3: Then the admin bar should not show the account "someone else"
 * Example #4: And the admin bar should show the account "editor"
 * Example #5: Then the admin bar should show the account "admin"
 *
 */
Then(/^the admin bar should( not)* show the account "([^"]*)"$/, async function (notCase, name) {
  const account = this.page.locator('#wp-admin-bar-my-account');
  await expectRendered(account, false, {
    label: 'the account menu of the admin bar ("#wp-admin-bar-my-account")',
    hint: 'The admin bar renders only for a logged-in session that has not turned it off in the profile.',
  });
  await expectText(account, name, notCase, { label: 'the account menu of the admin bar', timeout: budget(this) });
});

// ---------------------------------------------------------------------------
// Administration screens and roles
// ---------------------------------------------------------------------------

/**
 * Open an administration screen by its name: Dashboard, Posts, Pages, Media
 * Library, Comments, Themes, Plugins, Users, Profile, Tools, Site Health,
 * General Settings, Permalinks and the other screens of the dashboard menu.
 *
 * Example #1: Given I am on the "Plugins" admin screen
 * Example #2: Given we are on the "Posts" admin screen
 * Example #3: When I go to the "Dashboard" admin screen
 * Example #4: And I am on the "Site Health" admin screen
 * Example #5: When we go to the "Permalinks" admin screen
 *
 */
Given(/^(?:(?:I am |we are )*on|(?:I |we )*go to) the "([^"]*)" admin screen$/, async function (name) {
  await navigate(this, adminScreenPath(name));
});

/**
 * Assert the browser is on a named administration screen, or not. It is the
 * check of a role's landing page: after login every role lands on the
 * Dashboard, except a subscriber, who lands on the Profile.
 *
 * Example #1: Then I should be on the "Dashboard" admin screen
 * Example #2: And we should be on the "Profile" admin screen
 * Example #3: Then I should not be on the "Dashboard" admin screen
 * Example #4: And I should be on the "Posts" admin screen
 * Example #5: Then we should not be on the "Plugins" admin screen
 *
 */
Then(/^(I |we )*should( not)* be on the "([^"]*)" admin screen$/, async function (pronounCase, notCase, name) {
  const expected = new URL(siteRoot(this.launchUrl) + adminScreenPath(name));
  const matches = (url) => {
    const here = new URL(String(url));
    const samePath = here.pathname.replace(/index\.php$/, '') === expected.pathname.replace(/index\.php$/, '');
    return samePath && [...expected.searchParams].every(([key, value]) => here.searchParams.get(key) === value);
  };
  try {
    await this.page.waitForURL((url) => matches(url) !== Boolean(notCase), { timeout: budget(this) });
  } catch (err) {
    throw friendly({
      message: notCase
        ? `Expected not to be on the "${name}" admin screen, but this is it.`
        : `Expected to be on the "${name}" admin screen.`,
      cause: `the URL is ${this.page.url()}`,
      hint: 'A role without the capability is refused or redirected; check the account used.',
    });
  }
});

/**
 * Assert the browser is on the login page, or not. An anonymous visitor who
 * opens an administration screen is redirected there.
 *
 * Example #1: Then I should be on the login page
 * Example #2: And we should be on the login page
 * Example #3: Then I should not be on the login page
 * Example #4: And we should not be on the sign in page
 * Example #5: Then I should be on the sign-in page
 *
 */
Then(/^(I |we )*should( not)* be on the (?:sign[- ]?in|login) page$/, async function (pronounCase, notCase) {
  try {
    await this.page.waitForURL((url) => /\/wp-login\.php$/.test(new URL(String(url)).pathname) !== Boolean(notCase), { timeout: budget(this) });
  } catch (err) {
    throw friendly({
      message: notCase ? 'Expected to be off the login page.' : 'Expected to be on the login page.',
      cause: `the URL is ${this.page.url()}`,
      hint: 'WordPress redirects an anonymous visitor of /wp-admin/ to /wp-login.php.',
    });
  }
});

/**
 * Assert the page is WordPress's refusal for a missing capability: the "Sorry,
 * you are not allowed to access this page." screen. It is what a role sees on
 * an administration screen it may not use.
 *
 * Example #1: Then I should see the access denied screen
 * Example #2: And we should see the access denied screen
 * Example #3: Then should see the access denied screen
 * Example #4: Then I should not see the access denied screen
 * Example #5: But we should not see the access denied screen
 *
 */
Then(/^(I |we )*should( not)* see the access denied screen$/, async function (pronounCase, notCase) {
  const message = this.page.locator('body#error-page .wp-die-message');
  const hint = 'WordPress shows this screen (status 403) when the account lacks the capability; an anonymous visitor is sent to the login page instead.';
  await expectRendered(message, notCase, { label: 'the access denied screen ("#error-page .wp-die-message")', hint, timeout: budget(this) });
  if (!notCase) {
    await expectText(message, 'not allowed', false, { label: 'the access denied message', hint, timeout: budget(this) });
  }
});

/**
 * Assert the HTTP status of the page the browser is on, as the session
 * received it. Unlike webship-js's "response status code" step, which asks
 * again without the session, this reads the response the logged-in browser
 * got, so it is the check for administration screens and refusals.
 *
 * Example #1: Then the page should return HTTP status 200
 * Example #2: And the page should return HTTP status 403
 * Example #3: Then the page should not return HTTP status 500
 * Example #4: And the page should return status 404
 * Example #5: Then the page should not return status 403
 *
 */
Then(/^the page should( not)* return (?:HTTP )?status (\d+)$/, async function (notCase, code) {
  const status = this._lastResponseStatus;
  if (status === null || status === undefined) {
    throw friendly({
      message: 'No page response has been received yet.',
      hint: 'Open a page first, for example: Given I am on the homepage.',
    });
  }
  const expected = parseInt(code, 10);
  if ((status === expected) === Boolean(notCase)) {
    throw friendly({
      message: notCase
        ? `Expected the page not to return status ${expected}, but it did.`
        : `Expected the page to return status ${expected}.`,
      cause: `the session received status ${status} for ${this.page.url()}`,
    });
  }
});
