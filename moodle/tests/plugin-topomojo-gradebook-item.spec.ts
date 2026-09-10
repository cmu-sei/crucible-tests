// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * Adding a TopoMojo activity has to create its gradebook item, and editing it has
 * to keep that item in step with the activity's point maximum.
 *
 * `topomojo_grade_item_update()` builds the `grade_update()` call from whatever
 * record it is handed. A record assembled from partial form data can omit `grade`
 * or `course`, and a missing course id makes `grade_update()` bail out with
 * "Missing courseid or itemtype" — silently, so the activity looks fine and simply
 * never appears in the gradebook. A missing grade downgrades the item to
 * GRADE_TYPE_NONE, stripping grading from the activity. Both are recovered from
 * the stored record; this test drives the real form to prove it end to end.
 *
 * Along the way it pins down that the add form's grade field is ignored while the
 * edit form's is honoured, so the two paths are asserted separately.
 *
 * The activity is created through the UI and deleted in teardown.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import {
  connectMoodleDatabase,
  getMoodleTopomojoActivity,
  getMoodleTopomojoGradeItem,
} from '../db-helpers';
import { runMoodlePhp } from '../cli-helpers';

const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

// These tests drive a live TopoMojo: each run registers real gamespaces and holds
// real VMs. They also share one Moodle instance, so a second browser project would
// double the VM cost and — where a test borrows an existing account rather than
// seeding one — race the first project for the same records. One project is enough:
// what is under test is the plugin's server-side behaviour, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

/** Deliberately not 100, so a value that was ignored is distinguishable. */
const ACTIVITY_GRADE = 80;

/** What `topomojo_add_instance()` hardcodes, whatever the form said. */
const DEFAULT_GRADE = 100;

/**
 * Opens every collapsed section of a Moodle form.
 *
 * The activity form ships collapsed apart from its first section, so fields such
 * as the point maximum are present but not interactable until this runs.
 */
async function expandFormSections(page: Page): Promise<void> {
  const expandAll = page.locator('.collapsible-actions a.collapseexpand').first();
  if ((await expandAll.count()) === 0) {
    return;
  }

  // The control is inert until core_form/collapsesections binds it, and clicking
  // it before then is silently a no-op. Binding is what gives it the list of
  // sections it drives, so waiting for that attribute is waiting for the JS.
  await expect(expandAll).toHaveAttribute('aria-controls', /collapseElement/);

  if ((await expandAll.getAttribute('aria-expanded')) === 'false') {
    await expandAll.click();
  }
  await expect(expandAll).toHaveAttribute('aria-expanded', 'true');
}

/**
 * Chooses a workspace on the activity form.
 *
 * The field is an `autocomplete` element whose options are keyed by workspace id
 * but labelled with the workspace name, so the suggestion list never contains the
 * id. The label is read off the underlying select — which the enhancement leaves
 * in the DOM, hidden — rather than hardcoded, so the test follows whatever
 * TopoMojo currently calls the workspace.
 *
 * When the `autocomplete` admin setting is off the same element is a plain
 * select, which is handled directly.
 */
async function selectWorkspace(page: Page, workspaceId: string): Promise<void> {
  const select = page.locator('select#id_workspaceid');
  await expect(select, 'the form should offer a workspace list').toHaveCount(1);

  const option = select.locator(`option[value="${workspaceId}"]`);
  await expect(option, `workspace ${workspaceId} should be offered by TopoMojo`).toHaveCount(1);
  const workspaceName = ((await option.textContent()) || '').trim();
  expect(workspaceName, 'the workspace option should be labelled').not.toBe('');

  if (await select.isVisible()) {
    await select.selectOption(workspaceId);
    return;
  }

  const field = page.getByRole('combobox', { name: /Workspace/i });
  await field.click();
  await field.fill(workspaceName);

  const suggestion = page
    .locator('.form-autocomplete-suggestions li', { hasText: workspaceName })
    .first();
  await suggestion.waitFor({ state: 'visible', timeout: 30000 });
  await suggestion.click();

  // The enhancement writes the choice back to the select, which is what the form
  // actually submits.
  await expect(select).toHaveValue(workspaceId);
}

test.describe('mod_topomojo gradebook item', () => {
  test.describe.configure({ timeout: 5 * 60_000 });

  let courseId: number;
  let workspaceId: string;
  let activityName: string;
  let createdCmid: number | undefined;

  test.beforeAll(async () => {
    // Reuse the course and workspace an existing activity already points at, so
    // the test follows the environment rather than hardcoding either.
    const reference = await getMoodleTopomojoActivity(topomojoActivityId);
    courseId = reference.courseId;
    workspaceId = reference.workspaceId;
    activityName = `E2E Gradebook ${Date.now()}`;
  });

  test.afterAll(async () => {
    if (createdCmid) {
      // course_delete_module() removes the module, its grade item and its
      // question usages, which a direct DELETE would leave orphaned. Deleted
      // synchronously — its second argument is $async, and asking for an async
      // delete only flags the module and leaves the rows for cron to reap, so a
      // later run would still see them.
      runMoodlePhp(
        `require_once($CFG->dirroot . '/course/lib.php');`
        + ` course_delete_module(${createdCmid}, false);`
      );
      createdCmid = undefined;
    }
  });

  test('is created with the activity maximum when the activity is added', async ({ moodleAdminPage: page }) => {
    await page.goto(
      `${Services.Moodle}/course/modedit.php?add=topomojo&course=${courseId}&section=1`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    );

    await expandFormSections(page);

    await page.locator('#id_name').fill(activityName);
    await selectWorkspace(page, workspaceId);
    await page.locator('#id_grade').fill(String(ACTIVITY_GRADE));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
      page.locator('#id_submitbutton2').click(),
    ]);

    // A validation failure would leave us back on the form with the error shown.
    await expect(page.locator('#id_error_name, #id_error_workspaceid')).toHaveCount(0);

    const client = await connectMoodleDatabase();
    try {
      const created = await client.query<{ cmid: number; instanceid: number }>(
        `SELECT cm.id AS cmid, t.id AS instanceid
           FROM mdl_course_modules cm
           JOIN mdl_modules m ON m.id = cm.module AND m.name = 'topomojo'
           JOIN mdl_topomojo t ON t.id = cm.instance
          WHERE cm.course = $1 AND t.name = $2`,
        [courseId, activityName]
      );
      expect(created.rowCount, 'the activity should have been created').toBe(1);
      createdCmid = Number(created.rows[0].cmid);

      const activity = await getMoodleTopomojoActivity(createdCmid);

      // Pending upstream: topomojo_add_instance() assigns `$topomojo->grade = 100`
      // unconditionally, so the point maximum typed on the add form is discarded
      // and every new activity is stored as 100. The edit form does honour the
      // value (see the update test below), so this is only the add path. Asserted
      // as-is so the fix flips this expectation rather than quietly passing.
      expect(activity.grade, 'the add form discards the grade that was entered').toBe(DEFAULT_GRADE);

      const gradeItem = await getMoodleTopomojoGradeItem(courseId, activity.instanceId);
      expect(gradeItem, 'adding the activity should create its gradebook item').not.toBeNull();
      expect(gradeItem!.itemName).toBe(activityName);
      // GRADE_TYPE_VALUE. GRADE_TYPE_NONE (0) here would mean the point maximum
      // was lost on the way to grade_update().
      expect(gradeItem!.gradeType).toBe(1);
      // The item has to mirror whatever was stored, whatever that turns out to be.
      expect(gradeItem!.gradeMax).toBe(activity.grade);
      expect(gradeItem!.gradeMin).toBe(0);
    } finally {
      await client.end();
    }
  });

  test('shows the activity as a gradebook column with its maximum', async ({ moodleAdminPage: page }) => {
    expect(createdCmid, 'the creation test must have run first').toBeDefined();
    const activity = await getMoodleTopomojoActivity(createdCmid!);

    await page.goto(`${Services.Moodle}/grade/edit/tree/index.php?id=${courseId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const row = page.locator('tr', { hasText: activityName }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText(String(activity.grade));
  });

  test('follows the activity maximum when the activity is edited', async ({ moodleAdminPage: page }) => {
    expect(createdCmid, 'the creation test must have run first').toBeDefined();

    // The update path builds its record from form data rather than reading it
    // back, which is where course and grade can go missing: without a course id
    // grade_update() bails out silently and the item stops tracking the activity.
    await page.goto(`${Services.Moodle}/course/modedit.php?update=${createdCmid}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expandFormSections(page);
    await expect(page.locator('#id_name')).toHaveValue(activityName);

    await page.locator('#id_grade').fill(String(ACTIVITY_GRADE));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
      page.locator('#id_submitbutton2').click(),
    ]);

    const activity = await getMoodleTopomojoActivity(createdCmid!);
    expect(activity.grade, 'the edit form should store the grade that was entered').toBe(ACTIVITY_GRADE);

    const gradeItem = await getMoodleTopomojoGradeItem(courseId, activity.instanceId);
    expect(gradeItem, 'the gradebook item should survive an update').not.toBeNull();
    expect(gradeItem!.gradeType).toBe(1);
    expect(gradeItem!.gradeMax, 'the gradebook item should follow the new maximum').toBe(ACTIVITY_GRADE);
  });
});
