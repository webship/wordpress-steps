'use strict';

// WordPress step definitions for webship-js: comments.
//
// A visitor submits a comment on the public site, WordPress holds it for
// moderation (or publishes it), and a moderator approves, unapproves, trashes
// or deletes it on the Comments screen. The comment form assertion
// ("I should see the comment form") is in wordpress.steps.js.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  expectText,
  expectRendered,
  supplied,
} = require('./wordpress-helpers');

// The name and email a visitor comment carries when the step names none. The
// address is a test address, never a real subscriber.
const DEFAULT_COMMENTER = { name: 'Webship Tester', email: 'subscriber@example.com' };

/**
 * Submit a comment on the post that is open, through its comment form. A
 * visitor gives a name and an email, which default to a test commenter; a
 * logged-in user does not. The step fails with WordPress's own message when it
 * refuses the comment (a duplicate, comments too fast, comments closed).
 *
 * Example #1: When I submit the comment "Thank you for the article."
 * Example #2: When we submit the comment "A question about the page."
 * Example #3: And I submit the comment "Good point." as "Visitor" with the email "subscriber@example.com"
 * Example #4: When I submit the comment "Hello." as "Reader" with the email "info@webship.co"
 * Example #5: And we submit the comment "Second thoughts."
 *
 */
When(/^(I |we )*submit the comment "([^"]*)"(?: as "([^"]*)" with the email "([^"]*)")?$/, async function (pronounCase, text, name, email) {
  const form = this.page.locator('#commentform, form.comment-form').first();
  await expectRendered(form, false, {
    label: 'the comment form',
    hint: 'Open a post with open comments first: Given I am on a post. Comments may be closed on this entry or turned off in Settings > Discussion.',
    timeout: budget(this),
  });
  await form.locator('#comment').fill(text);
  const author = form.locator('#author');
  if (await author.count()) {
    await author.fill(supplied(name) ? name : DEFAULT_COMMENTER.name);
    await form.locator('#email').fill(supplied(email) ? email : DEFAULT_COMMENTER.email);
  }
  await Promise.all([
    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
    form.evaluate((element) => {
      const submit = element.querySelector('#submit, [type="submit"]');
      if (submit) submit.click(); else element.requestSubmit();
    }),
  ]);
  await settle(this);
  const refusal = this.page.locator('body#error-page .wp-die-message');
  if (await refusal.count()) {
    throw friendly({
      message: 'WordPress refused the comment.',
      cause: ((await refusal.textContent()) || '').replace(/\s+/g, ' ').trim(),
      hint: 'Duplicate comments, comments posted too quickly and closed comments are refused by core.',
    });
  }
  this.commentText = text;
});

// The comments of the open post as the theme renders them.
const COMMENT_ITEMS = '.wp-block-comment-template li, ol.comment-list li, .commentlist li';

/**
 * Assert the post on screen lists a comment, by its text. A comment held for
 * moderation is listed only to the visitor who sent it, with a note, on the
 * address WordPress returns after sending.
 *
 * Example #1: Then I should see the comment "Thank you for the article."
 * Example #2: And we should see the comment "A question about the page."
 * Example #3: Then I should not see the comment "Held back."
 * Example #4: And I should not see the comment "Spam text."
 * Example #5: Then we should see the comment "Good point."
 *
 */
Then(/^(I |we )*should( not)* see the comment "([^"]*)"$/, async function (pronounCase, notCase, text) {
  await expectText(this.page.locator(COMMENT_ITEMS), text, notCase, {
    label: 'the comments of the post',
    hint: 'Open the post first; a comment awaiting moderation is not public. Comments render in the comment list the theme provides.',
    timeout: budget(this),
  });
});

/**
 * Assert a comment on the post that is open is shown as awaiting moderation:
 * WordPress returns the sender to the post with a preview and the note "Your
 * comment is awaiting moderation."
 *
 * Example #1: Then the comment "Thank you for the article." should be awaiting moderation
 * Example #2: And the comment "A question about the page." should be awaiting moderation
 * Example #3: Then the comment "Published right away." should not be awaiting moderation
 * Example #4: And the comment "Good point." should not be awaiting moderation
 * Example #5: Then the comment "Held back." should be awaiting moderation
 *
 */
Then(/^the comment "([^"]*)" should( not)* be awaiting moderation$/, async function (text, notCase) {
  const comment = this.page.locator(COMMENT_ITEMS).filter({ hasText: text }).first();
  await expectRendered(comment, false, {
    label: `the comment "${text}"`,
    hint: 'Right after sending, WordPress shows a held comment to its sender. Later visits do not.',
    presenceOnly: true,
    timeout: budget(this),
  });
  await expectRendered(comment.locator('.comment-awaiting-moderation'), notCase, {
    label: `the moderation note of the comment "${text}"`,
    hint: 'The note is shown on the address WordPress returns to after the comment was sent.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

// The status views of the Comments screen and the row action of a moderation.
const COMMENT_VIEWS = {
  'pending': 'moderated',
  'approved': 'approved',
  'spam': 'spam',
  'in the trash': 'trash',
};
const COMMENT_ACTIONS = {
  approve: { view: 'moderated', link: '.approve a' },
  unapprove: { view: 'approved', link: '.unapprove a' },
  trash: { view: 'all', link: '.trash a' },
  spam: { view: 'all', link: '.spam a' },
  restore: { view: 'trash', link: '.untrash a' },
  delete: { view: 'trash', link: '.delete a' },
};

// The rows of the Comments screen in a status view, filtered by a text.
async function openComments(world, view, text) {
  await navigate(world, `/wp-admin/edit-comments.php?comment_status=${view}&s=${encodeURIComponent(text)}`);
  return world.page.locator('#the-comment-list tr').filter({ hasText: text });
}

/**
 * Moderate a comment on the Comments screen, by its text, with the row action:
 * approve, unapprove, trash, spam, restore (from the trash) or delete (from
 * the trash or the spam view, for good). The screen updates the row without leaving the page.
 *
 * Example #1: When I approve the comment "Thank you for the article."
 * Example #2: When we unapprove the comment "Good point."
 * Example #3: And I trash the comment "Spam text."
 * Example #4: When I restore the comment "Spam text."
 * Example #5: And we delete the comment "Spam text." permanently
 *
 */
When(/^(I |we )*(approve|unapprove|trash|spam|restore|delete) the comment "([^"]*)"(?: permanently)?$/, async function (pronounCase, action, text) {
  const { link } = COMMENT_ACTIONS[action];
  let { view } = COMMENT_ACTIONS[action];
  let row = (await openComments(this, view, text)).first();
  // A comment is deleted for good from the trash or from the spam view.
  if (action === 'delete' && !(await row.count())) {
    view = 'spam';
    row = (await openComments(this, view, text)).first();
  }
  await expectRendered(row, false, {
    label: `the comment "${text}" (${view === 'all' ? 'any status' : view})`,
    hint: 'The text is matched as a substring of the comment or its author, in the status view the action works from.',
    timeout: budget(this),
  });
  await row.hover();
  const action$ = row.locator(`.row-actions ${link}`).first();
  if (!(await action$.count())) {
    throw friendly({ message: `The comment "${text}" has no "${action}" action.`, hint: 'The account may lack the capability, or the comment is in another status.' });
  }
  if (action === 'delete') this.page.once('dialog', (dialog) => dialog.accept());
  // The actions send an Ajax request and update the row in place.
  await Promise.all([
    this.page.waitForResponse((response) => /admin-ajax\.php|comment\.php/.test(response.url()), { timeout: 15000 }).catch(() => {}),
    action$.click(),
  ]);
  await settle(this);
});

/**
 * Assert a comment is in a status on the Comments screen, by its text:
 * pending, approved, spam or in the trash.
 *
 * Example #1: Then the comment "Thank you for the article." should be pending
 * Example #2: And the comment "Good point." should be approved
 * Example #3: Then the comment "Spam text." should be in the trash
 * Example #4: And the comment "Held back." should not be approved
 * Example #5: Then the comment "Buy now." should be spam
 *
 */
Then(/^the comment "([^"]*)" should( not)* be (pending|approved|spam|in the trash)$/, async function (text, notCase, status) {
  const rows = await openComments(this, COMMENT_VIEWS[status], text);
  await expectRendered(rows.first(), notCase, {
    label: `the comment "${text}" among the ${status} comments`,
    hint: 'The text is matched as a substring of the comment or its author, and the account must be allowed to moderate.',
    presenceOnly: true,
    timeout: budget(this),
  });
});
