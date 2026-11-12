'use strict';

// WordPress step definitions for webship-js: content in the block editor.
//
// Posts and pages (create, write, publish, update, submit for review, trash,
// restore, delete), the lists that show them, categories and tags, and the
// media library. The block editor is driven through its own markup: the title
// and blocks in the `editor-canvas` iframe, the toolbar, the sidebar and the
// publish panel in the page, and the editor's data store for the saved state.

const path = require('path');
const fs = require('fs');
const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  settle,
  navigate,
  expectText,
  expectRendered,
  adminScreenPath,
  waitForEditor,
  editorCanvas,
  editorPost,
  waitForEditorSaved,
  WAIT_TIMEOUT,
} = require('./wordpress-helpers');

// The `post_type` query value and the admin screen name of a content noun.
const TYPES = {
  post: { type: 'post', list: 'Posts', add: '/wp-admin/post-new.php' },
  page: { type: 'page', list: 'Pages', add: '/wp-admin/post-new.php?post_type=page' },
};

// The status views of the posts list, by the words a feature uses.
const STATUS_VIEWS = {
  'published': { view: 'publish', label: 'published' },
  'a draft': { view: 'draft', label: 'a draft' },
  'pending review': { view: 'pending', label: 'pending review' },
  'scheduled': { view: 'future', label: 'scheduled' },
  'private': { view: 'private', label: 'private' },
  'in the trash': { view: 'trash', label: 'in the trash' },
};

function listUrl(noun, params) {
  const query = new URLSearchParams(Object.assign({ post_type: TYPES[noun].type }, params)).toString();
  return `/wp-admin/edit.php?${query}`;
}

// The row of a post or page in the list that is open, by its title.
function listRow(page, title) {
  return page.locator('#the-list tr').filter({ has: page.locator('.column-title, .title', { hasText: title }) }).first();
}

// ---------------------------------------------------------------------------
// The block editor
// ---------------------------------------------------------------------------

/**
 * Open the block editor on a new post or page.
 *
 * Example #1: Given I am on the new post screen
 * Example #2: Given we are on the new page screen
 * Example #3: When I go to the new post screen
 * Example #4: And I am on the new page screen
 * Example #5: When we go to the new page screen
 *
 */
Given(/^(?:(?:I am |we are )*on|(?:I |we )*go to) the new (post|page) screen$/, async function (noun) {
  await navigate(this, TYPES[noun].add);
  await waitForEditor(this);
  this.contentNoun = noun;
});

/**
 * Open an existing post or page in the block editor, found by its title in the
 * list. Drafts and pending entries are found too.
 *
 * Example #1: When I open the post "Hello world!" in the editor
 * Example #2: When we open the page "Sample Page" in the editor
 * Example #3: And I open the post "My draft" in the editor
 * Example #4: When I open the page "About" in the editor
 * Example #5: And we open the post "News" in the editor
 *
 */
When(/^(I |we )*open the (post|page) "([^"]*)" in the editor$/, async function (pronounCase, noun, title) {
  await navigate(this, listUrl(noun, { s: title, post_status: 'all' }));
  const row = listRow(this.page, title);
  await expectRendered(row, false, {
    label: `the ${noun} "${title}" in the list`,
    hint: `Check the title, and that the account may see it. Trashed entries are not in the "all" list.`,
    timeout: budget(this),
  });
  const href = await row.locator('.row-title').first().getAttribute('href');
  await navigate(this, href);
  await waitForEditor(this);
  this.contentNoun = noun;
});

/**
 * Set the title of the post or page in the editor.
 *
 * Example #1: When I set the post title to "A new post"
 * Example #2: When we set the page title to "About us"
 * Example #3: And I set the post title to "Edited title"
 * Example #4: When I set the page title to "Contact"
 * Example #5: And we set the post title to "News"
 *
 */
When(/^(I |we )*set the (post|page) title to "([^"]*)"$/, async function (pronounCase, noun, title) {
  const field = editorCanvas(this).locator('.editor-post-title__input');
  await expectRendered(field, false, {
    label: 'the title field of the editor',
    hint: 'Open the editor first: Given I am on the new post screen.',
    timeout: budget(this),
  });
  await field.click();
  await field.fill(title);
});

/**
 * Write a paragraph at the end of the content in the editor, by typing, as an
 * author does.
 *
 * Example #1: When I write "Hello from the test." in the post content
 * Example #2: When we write "About this site." in the page content
 * Example #3: And I write "A second paragraph." in the post content
 * Example #4: When I write "Contact us by mail." in the page content
 * Example #5: And we write "The end." in the post content
 *
 */
When(/^(I |we )*write "([^"]*)" in the (post|page) content$/, async function (pronounCase, text, noun) {
  const canvas = editorCanvas(this);
  const blocks = canvas.locator('[data-type]');
  await expectRendered(canvas.locator('.editor-post-title__input'), false, {
    label: 'the editor',
    hint: 'Open the editor first: Given I am on the new post screen.',
    timeout: budget(this),
  });
  if (await blocks.count()) {
    await blocks.last().click();
    await this.page.keyboard.press('Control+End');
  } else {
    await canvas.locator('.editor-post-title__input').click();
  }
  await this.page.keyboard.press('Enter');
  await this.page.keyboard.type(text);
});

// Open the editor's settings sidebar on its document tab ("Post" or "Page"),
// where the status, the trash button and the taxonomy panels are. The "Block"
// tab is the one showing while a block has the focus.
async function openDocumentSidebar(world, noun) {
  const toggle = world.page.locator('.editor-header__settings button[aria-label="Settings"]');
  await expectRendered(toggle, false, { label: 'the settings button of the editor', hint: 'Open the editor first.', timeout: budget(world) });
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
  const tab = world.page.locator('.interface-complementary-area').getByRole('tab', { name: noun === 'page' ? 'Page' : 'Post', exact: true });
  if (await tab.count()) await tab.first().click();
}

// Click the main button of the editor header (Publish, Update, Save, Submit
// for Review) and confirm the pre-publish panel when WordPress opens it.
async function pressPrimaryAction(world, expectedLabels) {
  const button = world.page.locator('.editor-header .editor-post-publish-button, .editor-header .editor-post-publish-panel__toggle').first();
  await expectRendered(button, false, { label: 'the publish button of the editor', hint: 'Open the editor first.', timeout: budget(world) });
  const label = ((await button.textContent()) || '').trim();
  if (!expectedLabels.some((expected) => expected.test(label))) {
    throw friendly({
      message: `The editor offers "${label}", not ${expectedLabels.map((expected) => `"${expected.source}"`).join(' or ')}.`,
      hint: 'A contributor may only submit for review; a published entry is updated, not published again.',
    });
  }
  if ((await button.getAttribute('aria-disabled')) === 'true') {
    throw friendly({ message: `The "${label}" button is disabled.`, hint: 'The entry has no changes to save, or has no title or content yet.' });
  }
  await button.click();
  const panel = world.page.locator('.editor-post-publish-panel');
  const confirm = panel.locator('.editor-post-publish-button');
  if (await confirm.first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
    await confirm.first().click();
  }
  return waitForEditorSaved(world);
}

/**
 * Publish the post or page in the editor: the Publish button and, when
 * WordPress asks, the confirmation of its pre-publish panel. It waits until
 * the status is "publish".
 *
 * Example #1: When I publish the post
 * Example #2: When we publish the page
 * Example #3: And I publish the post
 * Example #4: When I publish the page
 * Example #5: And we publish the post
 *
 */
When(/^(I |we )*publish the (post|page)$/, async function (pronounCase, noun) {
  const post = await pressPrimaryAction(this, [/^(Publish|Schedule)$/]);
  try {
    await this.page.waitForFunction(() => window.wp.data.select('core/editor').getCurrentPost().status === 'publish', null, { timeout: WAIT_TIMEOUT });
  } catch (err) {
    throw friendly({ message: `The ${noun} was not published.`, cause: `its status is "${post.status}"`, hint: 'The account may lack the capability to publish; use "I submit the post for review" for a contributor.' });
  }
  this.contentId = post.id;
  await settle(this);
});

/**
 * Update a published post or page in the editor, with the Save (or Update)
 * button, and wait for the save.
 *
 * Example #1: When I update the post
 * Example #2: When we update the page
 * Example #3: And I update the post
 * Example #4: When I update the page
 * Example #5: And we update the post
 *
 */
When(/^(I |we )*update the (post|page)$/, async function (pronounCase, noun) {
  const post = await pressPrimaryAction(this, [/^(Update|Save)$/]);
  this.contentId = post.id;
  await settle(this);
});

/**
 * Save the post or page as a draft, with the editor's "Save draft" button.
 *
 * Example #1: When I save the post as a draft
 * Example #2: When we save the page as a draft
 * Example #3: And I save the post as a draft
 * Example #4: When I save the page as a draft
 * Example #5: And we save the post as a draft
 *
 */
When(/^(I |we )*save the (post|page) as a draft$/, async function (pronounCase, noun) {
  const button = this.page.locator('.editor-header .editor-post-save-draft').first();
  await expectRendered(button, false, { label: 'the "Save draft" button', hint: 'Open the editor on an unpublished entry first, with some content.', timeout: budget(this) });
  await button.click();
  const post = await waitForEditorSaved(this);
  this.contentId = post.id;
  await settle(this);
});

/**
 * Submit the post or page for review, the Submit for Review button a
 * contributor has in place of Publish. The status becomes "pending".
 *
 * Example #1: When I submit the post for review
 * Example #2: When we submit the page for review
 * Example #3: And I submit the post for review
 * Example #4: When I submit the page for review
 * Example #5: And we submit the post for review
 *
 */
When(/^(I |we )*submit the (post|page) for review$/, async function (pronounCase, noun) {
  const post = await pressPrimaryAction(this, [/^Submit for Review$/]);
  this.contentId = post.id;
  await settle(this);
});

/**
 * Move the post or page that is open in the editor to the trash: the "Move to
 * trash" button of the sidebar and its confirmation. WordPress returns to the
 * list with a notice.
 *
 * Example #1: When I move the post to the trash
 * Example #2: When we move the page to the trash
 * Example #3: And I move the post to the trash
 * Example #4: When I move the page to the trash
 * Example #5: And we move the post to the trash
 *
 */
When(/^(I |we )*move the (post|page) to the trash$/, async function (pronounCase, noun) {
  await openDocumentSidebar(this, noun);
  const trash = this.page.getByRole('button', { name: 'Move to trash' }).first();
  await expectRendered(trash, false, { label: 'the "Move to trash" button of the sidebar', hint: 'Open an existing entry in the editor first; a new, unsaved entry has nothing to trash.', timeout: budget(this) });
  await trash.click();
  const dialog = this.page.locator('.components-modal__frame').getByRole('button', { name: 'Move to trash' });
  await Promise.all([
    this.page.waitForURL(/[?&]trashed=1/, { timeout: WAIT_TIMEOUT }).catch(() => {}),
    dialog.click(),
  ]);
  await settle(this);
});

/**
 * Assert the main button of the editor header offers an action, by its label:
 * "Publish" for an editor or an author, "Submit for Review" for a contributor,
 * "Save" or "Update" for an entry that is published already.
 *
 * Example #1: Then the editor should offer "Publish"
 * Example #2: And the editor should offer "Submit for Review"
 * Example #3: Then the editor should not offer "Publish"
 * Example #4: And the editor should not offer "Submit for Review"
 * Example #5: Then the editor should offer "Save"
 *
 */
Then(/^the editor should( not)* offer "([^"]*)"$/, async function (notCase, label) {
  const button = this.page.locator('.editor-header .editor-post-publish-button, .editor-header .editor-post-publish-panel__toggle').first();
  await expectRendered(button, false, { label: 'the publish button of the editor', hint: 'Open the editor first.', timeout: budget(this) });
  const actual = ((await button.textContent()) || '').trim();
  if ((actual === label) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the editor not to offer "${label}".` : `Expected the editor to offer "${label}".`,
      cause: `its main button reads "${actual}"`,
      hint: 'The label depends on the role and on the status of the entry.',
    });
  }
});

/**
 * Assert the status of the entry in the editor, as saved: published, a draft,
 * pending review or scheduled.
 *
 * Example #1: Then the post should be published in the editor
 * Example #2: And the page should be a draft in the editor
 * Example #3: Then the post should be pending review in the editor
 * Example #4: And the post should not be published in the editor
 * Example #5: Then the page should be scheduled in the editor
 *
 */
Then(/^the (post|page) should( not)* be (published|a draft|pending review|scheduled) in the editor$/, async function (noun, notCase, state) {
  const post = await editorPost(this);
  const wanted = { 'published': 'publish', 'a draft': 'draft', 'pending review': 'pending', 'scheduled': 'future' }[state];
  if ((post.status === wanted) === Boolean(notCase)) {
    throw friendly({
      message: notCase ? `Expected the ${noun} not to be ${state}.` : `Expected the ${noun} to be ${state}.`,
      cause: `its saved status is "${post.status}"`,
    });
  }
});

/**
 * Assert the editor shows a notice (a snackbar) such as "Post published.",
 * "Post updated." or "Draft saved."
 *
 * Example #1: Then I should see the editor notice "Post published."
 * Example #2: And we should see the editor notice "Post updated."
 * Example #3: Then I should see the editor notice "Page published."
 * Example #4: And I should not see the editor notice "Post updated."
 * Example #5: Then we should see the editor notice "Draft saved."
 *
 */
Then(/^(I |we )*should( not)* see the editor notice "([^"]*)"$/, async function (pronounCase, notCase, text) {
  await expectText(this.page.locator('.components-snackbar, .components-notice'), text, notCase, {
    label: 'the editor notices',
    hint: 'Editor notices disappear after a few seconds; assert right after the action.',
    timeout: budget(this),
  });
});

/**
 * Open the post or page that was last saved in the editor, on the public
 * site, through its `?p=` address (which follows the permalink).
 *
 * Example #1: When I view the post
 * Example #2: When we view the page
 * Example #3: And I view the post
 * Example #4: When I view the page
 * Example #5: And we view the post
 *
 */
When(/^(I |we )*view the (post|page)$/, async function (pronounCase, noun) {
  if (!this.contentId) {
    throw friendly({
      message: `There is no saved ${noun} to view yet.`,
      hint: 'Publish, update or save the entry in the editor first.',
    });
  }
  await navigate(this, '/?p=' + this.contentId);
});

// ---------------------------------------------------------------------------
// The lists of posts and pages
// ---------------------------------------------------------------------------

/**
 * Assert the list of posts or pages shows an entry, by its title, in any state
 * except the trash.
 *
 * Example #1: Then the posts list should include "Hello world!"
 * Example #2: And the pages list should include "Sample Page"
 * Example #3: Then the posts list should not include "Some old title"
 * Example #4: And the pages list should not include "No such page"
 * Example #5: Then the posts list should include "My draft"
 *
 */
Then(/^the (post|page)s list should( not)* include "([^"]*)"$/, async function (noun, notCase, title) {
  await navigate(this, listUrl(noun, { s: title, post_status: 'all' }));
  await expectRendered(listRow(this.page, title), notCase, {
    label: `the ${noun} "${title}" in the list`,
    hint: 'The title is matched as a substring; trashed entries are not in this list.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Assert the status of an entry, by its title, as the list's status views
 * show it: published, a draft, pending review, scheduled, private or in the
 * trash.
 *
 * Example #1: Then the post "Hello world!" should be published
 * Example #2: And the page "My page" should be a draft
 * Example #3: Then the post "Old news" should be in the trash
 * Example #4: And the post "Awaiting" should be pending review
 * Example #5: Then the post "Hello world!" should not be in the trash
 *
 */
Then(/^the (post|page) "([^"]*)" should( not)* be (published|a draft|pending review|scheduled|private|in the trash)$/, async function (noun, title, notCase, state) {
  await navigate(this, listUrl(noun, { s: title, post_status: STATUS_VIEWS[state].view }));
  await expectRendered(listRow(this.page, title), notCase, {
    label: `the ${noun} "${title}" among the ${state} entries`,
    hint: 'The title is matched as a substring, and the account must be allowed to see the entry.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

// A row action of a list entry (`trash`, `untrash`, `delete`), after pointing
// at the row so the action is shown.
async function listRowAction(world, noun, title, view, action) {
  await navigate(world, listUrl(noun, { s: title, post_status: view }));
  const row = listRow(world.page, title);
  await expectRendered(row, false, {
    label: `the ${noun} "${title}" in the list`,
    hint: 'Check the title, and that the account may do this to the entry.',
    timeout: budget(world),
  });
  const link = row.locator(`.row-actions .${action} a`).first();
  if (!(await link.count())) {
    throw friendly({ message: `The ${noun} "${title}" has no "${action}" action.`, hint: 'The account may lack the capability for it.' });
  }
  await row.hover();
  await Promise.all([world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}), link.click()]);
  await settle(world);
}

/**
 * Move an entry to the trash from the list, by its title.
 *
 * Example #1: When I move the post "Review post" to the trash from the list
 * Example #2: When we move the page "Old page" to the trash from the list
 * Example #3: And I move the post "Draft one" to the trash from the list
 * Example #4: When I move the page "About" to the trash from the list
 * Example #5: And we move the post "News" to the trash from the list
 *
 */
When(/^(I |we )*move the (post|page) "([^"]*)" to the trash from the list$/, async function (pronounCase, noun, title) {
  await listRowAction(this, noun, title, 'all', 'trash');
});

/**
 * Restore an entry from the trash, by its title.
 *
 * Example #1: When I restore the post "Review post" from the trash
 * Example #2: When we restore the page "Old page" from the trash
 * Example #3: And I restore the post "Draft one" from the trash
 * Example #4: When I restore the page "About" from the trash
 * Example #5: And we restore the post "News" from the trash
 *
 */
When(/^(I |we )*restore the (post|page) "([^"]*)" from the trash$/, async function (pronounCase, noun, title) {
  await listRowAction(this, noun, title, 'trash', 'untrash');
});

/**
 * Delete an entry from the trash for good, by its title. The entry must be in
 * the trash already. Use it at the end of a scenario that created content.
 *
 * Example #1: When I delete the post "Review post" permanently
 * Example #2: When we delete the page "Old page" permanently
 * Example #3: And I delete the post "Draft one" permanently
 * Example #4: When I delete the page "About" permanently
 * Example #5: And we delete the post "News" permanently
 *
 */
When(/^(I |we )*delete the (post|page) "([^"]*)" permanently$/, async function (pronounCase, noun, title) {
  await listRowAction(this, noun, title, 'trash', 'delete');
});

// ---------------------------------------------------------------------------
// Categories and tags
// ---------------------------------------------------------------------------

const TAXONOMIES = { category: 'category', tag: 'post_tag' };

/**
 * Add a category or a tag on its screen, by name.
 *
 * Example #1: When I add the category "Reports"
 * Example #2: When we add the tag "webship"
 * Example #3: And I add the category "News"
 * Example #4: When I add the tag "release"
 * Example #5: And we add the category "Events"
 *
 */
When(/^(I |we )*add the (category|tag) "([^"]*)"$/, async function (pronounCase, kind, name) {
  await navigate(this, `/wp-admin/edit-tags.php?taxonomy=${TAXONOMIES[kind]}`);
  const field = this.page.locator('#addtag #tag-name');
  await expectRendered(field, false, { label: `the "${kind}" name field`, hint: 'The account must be allowed to manage terms.', timeout: budget(this) });
  await field.fill(name);
  await this.page.locator('#addtag #submit').click();
  await expectRendered(this.page.locator('#the-list .row-title', { hasText: name }).first(), false, {
    label: `the new ${kind} "${name}" in the list`,
    hint: 'WordPress adds the row after saving; a name that exists already is refused with an error.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Assert a category or a tag exists, by name.
 *
 * Example #1: Then the category "Reports" should exist
 * Example #2: And the tag "webship" should exist
 * Example #3: Then the category "Removed" should not exist
 * Example #4: And the tag "gone" should not exist
 * Example #5: Then the category "Uncategorized" should exist
 *
 */
Then(/^the (category|tag) "([^"]*)" should( not)* exist$/, async function (kind, name, notCase) {
  await navigate(this, `/wp-admin/edit-tags.php?taxonomy=${TAXONOMIES[kind]}&s=${encodeURIComponent(name)}`);
  await expectRendered(this.page.locator('#the-list .row-title', { hasText: name }).first(), notCase, {
    label: `the ${kind} "${name}"`,
    hint: 'The name is matched as a substring on the terms screen.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Delete a category or a tag, by name, from its screen. The row action asks
 * the browser to confirm, and the step accepts it.
 *
 * Example #1: When I delete the category "Reports"
 * Example #2: When we delete the tag "webship"
 * Example #3: And I delete the category "News"
 * Example #4: When I delete the tag "release"
 * Example #5: And we delete the category "Events"
 *
 */
When(/^(I |we )*delete the (category|tag) "([^"]*)"$/, async function (pronounCase, kind, name) {
  await navigate(this, `/wp-admin/edit-tags.php?taxonomy=${TAXONOMIES[kind]}&s=${encodeURIComponent(name)}`);
  const row = this.page.locator('#the-list tr').filter({ has: this.page.locator('.row-title', { hasText: name }) }).first();
  await expectRendered(row, false, { label: `the ${kind} "${name}"`, hint: 'The name is matched as a substring on the terms screen.', timeout: budget(this) });
  await row.hover();
  this.page.once('dialog', (dialog) => dialog.accept());
  await row.locator('.row-actions .delete a').first().click();
  await expectRendered(row, true, { label: `the ${kind} "${name}"`, hint: 'WordPress removes the row when the deletion succeeds.', presenceOnly: true, timeout: budget(this) });
});

// Open the sidebar panel of a taxonomy in the editor.
async function openTaxonomyPanel(world, kind) {
  await openDocumentSidebar(world, 'post');
  const heading = kind === 'category' ? 'Categories' : 'Tags';
  const panelButton = world.page.locator('.interface-complementary-area').getByRole('button', { name: heading, exact: true }).first();
  await expectRendered(panelButton, false, { label: `the "${heading}" panel of the editor sidebar`, hint: 'Open the editor on a post first. Pages have no categories or tags.', timeout: budget(world) });
  if ((await panelButton.getAttribute('aria-expanded')) !== 'true') await panelButton.click();
}

/**
 * File the post under a category, in the editor sidebar. The category must
 * exist already (see "I add the category").
 *
 * Example #1: When I file the post under the category "Reports"
 * Example #2: When we file the post under the category "News"
 * Example #3: And I file the post under the category "Events"
 * Example #4: When I file the post under the category "Uncategorized"
 * Example #5: And we file the post under the category "Releases"
 *
 */
When(/^(I |we )*file the post under the category "([^"]*)"$/, async function (pronounCase, name) {
  await openTaxonomyPanel(this, 'category');
  const box = this.page.locator('.interface-complementary-area').getByRole('checkbox', { name, exact: true }).first();
  await expectRendered(box, false, { label: `the category "${name}" in the editor sidebar`, hint: 'Add the category first: When I add the category "..."; reload the editor to see it.', timeout: budget(this) });
  await box.check();
});

/**
 * Tag the post in the editor sidebar. A tag that does not exist is created by
 * WordPress when the post is saved.
 *
 * Example #1: When I tag the post with "webship"
 * Example #2: When we tag the post with "release"
 * Example #3: And I tag the post with "testing"
 * Example #4: When I tag the post with "news"
 * Example #5: And we tag the post with "wordpress"
 *
 */
When(/^(I |we )*tag the post with "([^"]*)"$/, async function (pronounCase, name) {
  await openTaxonomyPanel(this, 'tag');
  const input = this.page.locator('.interface-complementary-area').locator('input.components-form-token-field__input').first();
  await expectRendered(input, false, { label: 'the tags field of the editor sidebar', hint: 'Open the editor on a post first.', timeout: budget(this) });
  await input.click();
  await input.fill(name);
  await this.page.keyboard.press('Enter');
});

/**
 * Assert the post on the public site lists a category or a tag, by name, the
 * links a theme renders with `rel="category"` and `rel="tag"`.
 *
 * Example #1: Then the post should be in the category "Reports"
 * Example #2: And the post should be in the tag "webship"
 * Example #3: Then the post should not be in the category "News"
 * Example #4: And the post should not be in the tag "release"
 * Example #5: Then the post should be in the category "Uncategorized"
 *
 */
Then(/^the post should( not)* be in the (category|tag) "([^"]*)"$/, async function (notCase, kind, name) {
  const links = this.page.locator(`main a[rel~="${kind}"], .entry-meta a[rel~="${kind}"], .wp-block-post-terms a`);
  await expectText(links, name, notCase, {
    label: `the ${kind} links of the post`,
    hint: 'View the post on the public site first: When I view the post. A theme that hides terms fails this step.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------

// The file a step names: an absolute path, or a file of the assets folder
// (`this.assetsFolder`, webship-js's own `tests/assets/` unless set), or of the
// project's `tests/assets/`.
function assetFile(world, name) {
  if (path.isAbsolute(name) && fs.existsSync(name)) return name;
  const candidates = [
    world.assetsFolder && path.resolve(world.assetsFolder, name),
    path.resolve(process.cwd(), 'tests', 'assets', name),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw friendly({
      message: `The file "${name}" was not found.`,
      hint: `Looked in: ${candidates.join(', ')}. Put the file in the project's tests/assets/ folder, or use an absolute path.`,
    });
  }
  return found;
}

/**
 * Upload a file to the media library, on the Add Media File screen: the file
 * is given to the uploader and the step waits until WordPress lists it.
 *
 * Example #1: When I upload the media file "webshipco.png"
 * Example #2: When we upload the media file "test-document.pdf"
 * Example #3: And I upload the media file "webshipco.png"
 * Example #4: When I upload the media file "/tmp/photo.jpg"
 * Example #5: And we upload the media file "test-document.pdf"
 *
 */
When(/^(I |we )*upload the media file "([^"]*)"$/, async function (pronounCase, name) {
  const file = assetFile(this, name);
  await navigate(this, adminScreenPath('Add Media File'));
  const input = this.page.locator('#plupload-upload-ui input[type="file"]').first();
  await expectRendered(input, false, { label: 'the media uploader', hint: 'The account must be allowed to upload files (an author or above).', presenceOnly: true, timeout: budget(this) });
  await input.setInputFiles(file);
  const item = this.page.locator('#media-items .media-item').first();
  try {
    await item.locator('.edit-attachment, .error, .error-div').first().waitFor({ state: 'attached', timeout: WAIT_TIMEOUT });
  } catch (err) {
    throw friendly({ message: `WordPress did not finish uploading "${name}".`, cause: err, hint: 'Check the file type and size against the upload limits of the site.' });
  }
  const failure = item.locator('.error, .error-div').first();
  if (await failure.count()) {
    throw friendly({ message: `WordPress refused the file "${name}".`, cause: ((await failure.textContent()) || '').replace(/\s+/g, ' ').trim() });
  }
});

// The media library list, searched for a title.
async function openMediaList(world, title) {
  await navigate(world, `/wp-admin/upload.php?mode=list&s=${encodeURIComponent(title)}`);
}

/**
 * Assert the media library lists a file, by its title (the file name without
 * its extension).
 *
 * Example #1: Then the media library should list "webshipco"
 * Example #2: And the media library should list "test-document"
 * Example #3: Then the media library should not list "deleted-file"
 * Example #4: And the media library should not list "no-such-file"
 * Example #5: And the media library should list "photo"
 *
 */
Then(/^the media library should( not)* list "([^"]*)"$/, async function (notCase, title) {
  await openMediaList(this, title);
  await expectRendered(this.page.locator('#the-list tr .title a', { hasText: title }).first(), notCase, {
    label: `the media file "${title}" in the library`,
    hint: 'The title is the file name without its extension, matched as a substring.',
    presenceOnly: true,
    timeout: budget(this),
  });
});

/**
 * Delete a media file for good, by its title, with the "Delete Permanently"
 * row action of the library. The browser's confirmation is accepted. Use it at
 * the end of a scenario that uploaded a file.
 *
 * Example #1: When I delete the media file "webshipco" permanently
 * Example #2: When we delete the media file "test-document" permanently
 * Example #3: And I delete the media file "webshipco" permanently
 * Example #4: When I delete the media file "photo" permanently
 * Example #5: And we delete the media file "test-document" permanently
 *
 */
When(/^(I |we )*delete the media file "([^"]*)" permanently$/, async function (pronounCase, title) {
  await openMediaList(this, title);
  const row = this.page.locator('#the-list tr').filter({ has: this.page.locator('.title a', { hasText: title }) }).first();
  await expectRendered(row, false, { label: `the media file "${title}" in the library`, hint: 'The title is the file name without its extension.', timeout: budget(this) });
  await row.hover();
  this.page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
    row.locator('.row-actions .delete a').first().click(),
  ]);
  await settle(this);
});
