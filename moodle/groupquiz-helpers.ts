// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Seeding and teardown helpers for the mod_groupquiz specs.
 *
 * mod_groupquiz cannot be exercised without a fair amount of course scaffolding:
 * the activity form *requires* a grouping, and a student only reaches the attempt
 * UI if they are enrolled in the course AND a member of a group inside that
 * grouping. Every helper here drives the real admin UI (no direct DB access and no
 * web-service tokens) so the seeding path is itself covered by the specs that use it.
 *
 * Naming: everything a spec creates carries a per-test suffix from `seedSuffix()` so
 * parallel-safe lookups never collide with leftovers from a previous run, and so a
 * failed run leaves obviously-identifiable residue. Deleting the seeded course also
 * removes its groups, groupings, activity, attempts and question category, so most
 * cleanup is a single `deleteCourse` call; seeded users are deleted separately.
 *
 * This file is intentionally NOT a spec (no `*.spec.ts` suffix) so Playwright's
 * `testMatch` skips it.
 */

import { expect, Locator, Page } from '@playwright/test';
import { Services } from '../shared-fixtures';

/** Moodle pages are server-rendered and can be slow on a cold cache. */
const NAV = { waitUntil: 'domcontentloaded' as const, timeout: 60000 };
const ACTION_TIMEOUT = 60000;
/**
 * Options for waiting on a form submission's redirect. `commit` settles as soon as the
 * response for the new URL starts arriving: Moodle course pages pull in enough
 * subresources that waiting for a full `load` is both slower and flakier than letting
 * the following locator assertions wait for what they actually need.
 */
export const URL_WAIT = { waitUntil: 'commit' as const, timeout: ACTION_TIMEOUT };

export interface SeededCourse {
  id: string;
  fullName: string;
  shortName: string;
}

export interface SeededGrouping {
  course: SeededCourse;
  groupId: string;
  groupName: string;
  groupingId: string;
  groupingName: string;
}

export interface SeededUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
}

/** Suffix that makes every seeded record name unique to one test run. */
export function seedSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`.toUpperCase();
}

export async function gotoMoodle(page: Page, path: string): Promise<void> {
  await page.goto(`${Services.Moodle}${path}`, NAV);
}

/**
 * Resolve the `value` of the first `<option>` whose text contains `fragment`.
 *
 * Moodle's two-panel selectors label options with composed text ("Full Name
 * (email@example.test)", "Group Name (0)"), and `selectOption` does not accept a
 * regular expression, so matching has to happen in the page. The returned value is
 * often useful on its own: in the enrolment selector it is the user's id.
 */
export async function optionValueContaining(
  select: Locator,
  fragment: string
): Promise<string> {
  await select.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
  const value = await select.evaluate((el, text) => {
    const option = Array.from((el as HTMLSelectElement).options).find((o) =>
      (o.textContent ?? '').includes(text)
    );
    return option ? option.value : '';
  }, fragment);
  expect(value, `a select option containing "${fragment}" should exist`).not.toBe('');
  return value;
}

/** Select the first option whose text contains `fragment`; returns its value. */
export async function selectOptionContaining(
  select: Locator,
  fragment: string
): Promise<string> {
  const value = await optionValueContaining(select, fragment);
  await select.selectOption(value);
  return value;
}

// ---------------------------------------------------------------------------
// Course, group and grouping scaffolding
// ---------------------------------------------------------------------------

export async function createCourse(
  page: Page,
  fullName: string,
  shortName: string
): Promise<SeededCourse> {
  await gotoMoodle(page, '/course/edit.php?category=1');
  await page.fill('#id_fullname', fullName);
  await page.fill('#id_shortname', shortName);
  await page.locator('#id_saveanddisplay').click();
  await page.waitForURL(/\/course\/view\.php\?id=\d+/, URL_WAIT);
  const id = new URL(page.url()).searchParams.get('id');
  expect(id, 'saving a new course should redirect to its course page').toBeTruthy();
  return { id: id as string, fullName, shortName };
}

export async function deleteCourse(page: Page, courseId: string): Promise<void> {
  await gotoMoodle(page, `/course/delete.php?id=${courseId}`);
  // Scope to #region-main: the message drawer also renders "Delete" controls.
  const main = page.locator('#region-main');
  await main.getByRole('button', { name: 'Delete', exact: true }).click();
  // The deletion runs inline and reports each removed subsystem before offering
  // Continue, which can take a while on a course that has quiz attempts.
  const proceed = main.getByRole('button', { name: 'Continue', exact: true });
  await proceed.waitFor({ state: 'visible', timeout: 120000 });
  await proceed.click();
  await page.waitForURL(/\/course\/management\.php/, URL_WAIT);
}

export async function createGroup(
  page: Page,
  courseId: string,
  name: string
): Promise<string> {
  await gotoMoodle(page, `/group/group.php?courseid=${courseId}`);
  await page.fill('#id_name', name);
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/group\/index\.php/, URL_WAIT);
  // The group list is a <select>; its option values are the group ids.
  return optionValueContaining(page.locator('#groups'), name);
}

export async function createGrouping(
  page: Page,
  courseId: string,
  name: string
): Promise<string> {
  await gotoMoodle(page, `/group/grouping.php?courseid=${courseId}`);
  await page.fill('#id_name', name);
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/group\/groupings\.php/, URL_WAIT);
  const row = page.locator('#region-main table tbody tr').filter({ hasText: name });
  const href = await row.locator('a[href*="grouping.php?id="]').first().getAttribute('href');
  expect(href, `grouping "${name}" should appear in the groupings list`).toBeTruthy();
  const groupingId = new URL(href as string, Services.Moodle).searchParams.get('id');
  expect(groupingId, 'grouping row should link to the grouping id').toBeTruthy();
  return groupingId as string;
}

export async function addGroupToGrouping(
  page: Page,
  groupingId: string,
  groupName: string
): Promise<void> {
  await gotoMoodle(page, `/group/assign.php?id=${groupingId}`);
  await selectOptionContaining(page.locator('#addselect'), groupName);
  await page.locator('#add').click();
  await expect(page.locator('#removeselect')).toContainText(groupName);
}

/** Course + one group + one grouping containing that group: the minimum mod_groupquiz needs. */
export async function seedCourseWithGrouping(
  page: Page,
  suffix: string
): Promise<SeededGrouping> {
  const course = await createCourse(page, `GQ E2E Course ${suffix}`, `GQE2E${suffix}`);
  const groupName = `GQ Group ${suffix}`;
  const groupingName = `GQ Grouping ${suffix}`;
  const groupId = await createGroup(page, course.id, groupName);
  const groupingId = await createGrouping(page, course.id, groupingName);
  await addGroupToGrouping(page, groupingId, groupName);
  return { course, groupId, groupName, groupingId, groupingName };
}

// ---------------------------------------------------------------------------
// The activity itself
// ---------------------------------------------------------------------------

export async function openAddGroupQuizForm(
  page: Page,
  courseId: string,
  section = 1
): Promise<void> {
  await gotoMoodle(page, `/course/modedit.php?add=groupquiz&course=${courseId}&section=${section}`);
  await expect(page.locator('#id_name')).toBeVisible();
}

/** Adds a Group Quiz to a course and returns its course-module id. */
export async function addGroupQuiz(
  page: Page,
  options: { courseId: string; name: string; groupingName: string; section?: number }
): Promise<string> {
  await openAddGroupQuizForm(page, options.courseId, options.section ?? 1);
  await page.fill('#id_name', options.name);
  await selectOptionContaining(page.locator('#id_grouping'), options.groupingName);
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/mod\/groupquiz\/view\.php\?id=\d+/, URL_WAIT);
  const cmid = new URL(page.url()).searchParams.get('id');
  expect(cmid, 'saving the activity should redirect to its view page').toBeTruthy();
  return cmid as string;
}

/**
 * Fill a Moodle "rich text" field. This install renders the raw textarea for
 * question text, but a site with TinyMCE enabled hides it behind an iframe.
 */
async function fillEditorField(page: Page, fieldId: string, text: string): Promise<void> {
  const textarea = page.locator(`#${fieldId}`);
  if (await textarea.isVisible().catch(() => false)) {
    await textarea.fill(text);
    return;
  }
  await page.frameLocator(`#${fieldId}_ifr`).locator('body').fill(text);
}

/**
 * Create a True/False question (correct answer True) in the quiz's own question
 * bank via the bank embedded in the mod_groupquiz edit tab.
 */
export async function createTrueFalseQuestion(
  page: Page,
  cmid: string,
  name: string,
  questionText: string
): Promise<void> {
  await gotoMoodle(page, `/mod/groupquiz/edit.php?cmid=${cmid}`);
  await page
    .locator('#region-main')
    .getByRole('button', { name: /Create a new question/i })
    .click();
  // The qtype chooser markup exists more than once in the DOM (the inline
  // #qtypechoicecontainer template plus the modal), so pin the visible dialog.
  const chooser = page
    .locator('.modal-dialog, [role="dialog"]')
    .filter({ visible: true })
    .filter({ hasText: 'Choose a question type to add' })
    .last();
  // The modal fetches its question-type list, so wait for it to render before choosing.
  const trueFalse = chooser.locator('input[name="qtype"][value="truefalse"]');
  await trueFalse.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
  await trueFalse.check();
  await chooser.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForURL(/\/question\/bank\/editquestion\/question\.php/, URL_WAIT);
  await page.fill('#id_name', name);
  await fillEditorField(page, 'id_questiontext', questionText);
  await page.selectOption('#id_correctanswer', { label: 'True' });
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/mod\/groupquiz\/edit\.php/, URL_WAIT);
}

/**
 * Add a bank question to the quiz's question list. mod_groupquiz interposes a
 * points form between "Add Questions to Group Quiz" and the question landing in
 * the list, so both steps happen here.
 */
export async function addQuestionToQuiz(
  page: Page,
  cmid: string,
  questionName: string,
  points = '1.00'
): Promise<void> {
  await gotoMoodle(page, `/mod/groupquiz/edit.php?cmid=${cmid}`);
  // The embedded bank shows the seeded course's own category, which holds only the
  // question this test created, so the row is found by name rather than by paging.
  const bankRow = page
    .locator('#categoryquestions tbody tr')
    .filter({ hasText: questionName });
  const rowCheckbox = bankRow.locator('input[type="checkbox"]').first();
  await rowCheckbox.check();
  const addSelected = page.locator('input[name="addquestionlist"]');
  // The bank ships the button disabled and the question bank's toggle-group JS enables
  // it in response to a selection. Checking the row before that JS has bound leaves the
  // button disabled with no further event coming, so re-toggle once before giving up.
  try {
    await expect(addSelected).toBeEnabled({ timeout: 5000 });
  } catch {
    await rowCheckbox.uncheck();
    await rowCheckbox.check();
    await expect(addSelected).toBeEnabled({ timeout: 30000 });
  }
  await addSelected.click();
  const pointsField = page.locator('#id_points');
  await pointsField.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
  await pointsField.fill(points);
  await page.locator('#id_submitbutton').click();
  await expect(page.locator('#questionrow')).toContainText(questionName);
}

// ---------------------------------------------------------------------------
// Users, enrolment and group membership
// ---------------------------------------------------------------------------

/**
 * Create a manual-auth Moodle account. The specs need a student who can log in
 * through the local form; Keycloak-provisioned accounts would depend on the IdP's
 * auto-provision and confirmation settings, which are not part of this plugin.
 */
export async function createLocalUser(
  page: Page,
  user: { username: string; password: string; firstName: string; lastName: string }
): Promise<void> {
  await gotoMoodle(page, '/user/editadvanced.php?id=-1');
  // Manual accounts is the default, but set it explicitly: the site also offers
  // OAuth2 and email-confirmation methods that would break the password login.
  await page.selectOption('#id_auth', 'manual');
  await page.fill('#id_username', user.username);
  // The new-password field is a passwordunmask widget: it stays hidden until its
  // "Click to enter text" control is used.
  await page.click('[data-passwordunmaskid="id_newpassword"] [data-passwordunmask="edit"]');
  await page.fill('#id_newpassword', user.password);
  await page.fill('#id_firstname', user.firstName);
  await page.fill('#id_lastname', user.lastName);
  await page.fill('#id_email', `${user.username}@example.test`);
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/admin\/user\.php/, URL_WAIT);
}

/**
 * Delete a seeded account. The user list is a report-builder table with randomized
 * field ids, so this uses the row action's own URL shape (delete id + sesskey),
 * which renders a server-side confirmation page.
 */
export async function deleteLocalUser(page: Page, userId: string): Promise<void> {
  await gotoMoodle(page, '/admin/user.php');
  const sesskey = await page.evaluate(
    () => (window as unknown as { M?: { cfg?: { sesskey?: string } } }).M?.cfg?.sesskey ?? ''
  );
  expect(sesskey, 'admin pages should expose M.cfg.sesskey').not.toBe('');
  await gotoMoodle(page, `/admin/user.php?delete=${userId}&sesskey=${sesskey}`);
  await page
    .locator('#region-main')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.waitForURL(
    (url) => url.pathname.endsWith('/admin/user.php') && !url.search.includes('delete='),
    URL_WAIT
  );
}

/** Enrol a user as Student through the manual enrolment instance; returns the user id. */
export async function enrolAsStudent(
  page: Page,
  courseId: string,
  userFragment: string
): Promise<string> {
  await gotoMoodle(page, `/enrol/instances.php?id=${courseId}`);
  const manageHref = await page
    .locator('a[href*="/enrol/manual/manage.php"]')
    .first()
    .getAttribute('href');
  expect(manageHref, 'course should have a manual enrolment instance').toBeTruthy();
  const enrolId = new URL(manageHref as string, Services.Moodle).searchParams.get('enrolid');
  await gotoMoodle(page, `/enrol/manual/manage.php?enrolid=${enrolId}`);
  await page.selectOption('#menuroleid', { label: 'Student' });
  // In this selector the option value is the user id.
  const userId = await selectOptionContaining(page.locator('#addselect'), userFragment);
  await page.locator('#add').click();
  await expect(page.locator('#removeselect')).toContainText(userFragment);
  return userId;
}

export async function addUserToGroup(
  page: Page,
  groupId: string,
  userFragment: string
): Promise<void> {
  await gotoMoodle(page, `/group/members.php?group=${groupId}`);
  await selectOptionContaining(page.locator('#addselect'), userFragment);
  await page.locator('#add').click();
  await expect(page.locator('#removeselect')).toContainText(userFragment);
}

/** Log in through Moodle's local login form (not the Keycloak IdP link). */
export async function loginWithLocalAccount(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await gotoMoodle(page, '/login/index.php');
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.locator('#loginbtn').click();
  await page
    .locator('#user-menu-toggle')
    .first()
    .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT });
}
