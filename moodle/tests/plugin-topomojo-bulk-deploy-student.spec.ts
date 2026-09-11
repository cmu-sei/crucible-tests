// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * What a student actually gets when they open a lab that was bulk-deployed to
 * them, and what it grades to.
 *
 * The activity has imported challenge questions, and the attempt the launcher wrote
 * carries a question usage over them, so the student should get the same challenge a
 * self-started lab does. That was not always so: the attempt used to be inserted
 * without a usage, and every page that reached for one had to cope with null — which
 * is the crash this path used to be, and then the dead end it survived to, where the
 * student was shown no questions and graded zero for not answering them. Asserted
 * here: that the pages render, that the questions are actually on them, and what the
 * student's grade ends up as when they leave those questions blank.
 *
 * A pre-existing Keycloak account is borrowed rather than created, because the
 * login goes through the identity provider and a DB-seeded Moodle user has no
 * credentials there. Everything the deploy leaves on that account is removed in
 * teardown; the account itself and its enrolment are left as they were.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleTopomojoDeployments,
  connectMoodleDatabase,
  getMoodleQuestionUsage,
  getMoodleTopomojoActivity,
  getMoodleTopomojoAttempts,
  getMoodleTopomojoDeployments,
  MoodleTopomojoActivity,
} from '../db-helpers';
import { queueMoodleTopomojoBulkDeploy, runMoodleAdhocTask } from '../cli-helpers';
import { deleteGamespace, getTopoMojoAdminToken } from '../../topomojo-helpers';

const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

// These tests drive a live TopoMojo: each run registers real gamespaces and holds
// real VMs. They also share one Moodle instance, so a second browser project would
// double the VM cost and — where a test borrows an existing account rather than
// seeding one — race the first project for the same records. One project is enough:
// what is under test is the plugin's server-side behaviour, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

const BULKDEPLOY_TASK = '\\mod_topomojo\\task\\bulkdeploy_run';
const demoUsername = process.env.MOODLE_DEMO_USERNAME || 'demo-user';

/** Resolves the Moodle user the demo Keycloak account maps to. */
async function findDemoUserId(): Promise<number> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM mdl_user
        WHERE deleted = 0 AND (username = $1 OR username LIKE $2)
        ORDER BY id
        LIMIT 1`,
      [demoUsername, `${demoUsername}@%`]
    );
    if (result.rowCount !== 1) {
      throw new Error(`No Moodle account for the demo Keycloak user "${demoUsername}".`);
    }
    return Number(result.rows[0].id);
  } finally {
    await client.end();
  }
}

async function openActivity(page: Page): Promise<void> {
  await page.goto(`${Services.Moodle}/mod/topomojo/view.php?id=${topomojoActivityId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
}

/**
 * Moodle renders an uncaught exception as a debug-mode error page. Asserting on
 * that markup catches the crash this path used to be, rather than only noticing
 * a missing element later on.
 */
async function expectNoMoodleError(page: Page): Promise<void> {
  await expect(page.locator('.errormessage, #region-main .alert-danger')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Debug info:');
  await expect(page.locator('body')).not.toContainText('Exception - Attempt to read property');
}

test.describe('mod_topomojo bulk-deployed attempt, as the student', () => {
  test.describe.configure({ mode: 'serial', timeout: 15 * 60_000 });

  let activity: MoodleTopomojoActivity;
  let studentUserId: number;
  let topoToken: string;

  test.beforeAll(async () => {
    topoToken = await getTopoMojoAdminToken();
    activity = await getMoodleTopomojoActivity(topomojoActivityId);
    studentUserId = await findDemoUserId();

    // Start from a clean slate: an attempt left over from an earlier run would be
    // picked up as the open attempt and the deploy below would be skipped.
    const stale = await cleanupMoodleTopomojoDeployments([activity.instanceId], [studentUserId]);
    for (const gamespaceId of stale) {
      await deleteGamespace(topoToken, gamespaceId);
    }

    const jobId = queueMoodleTopomojoBulkDeploy(topomojoActivityId, [studentUserId]);
    const taskOutput = runMoodleAdhocTask(BULKDEPLOY_TASK);

    const attempts = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    // The task records a per-user failure and still completes successfully, so the
    // rows it wrote and its own output are carried into the failure message —
    // otherwise a TopoMojo error, a skipped user and a task that was never picked up
    // all look identical from here. Teardown deletes these rows, so this is the only
    // chance to see them.
    const deployments = await getMoodleTopomojoDeployments([activity.instanceId], [studentUserId]);
    expect(
      attempts,
      `the bulk deploy should have created an attempt for the student.`
        + `\nStudent: userId=${studentUserId} (${demoUsername})`
        + `\nJob: ${jobId}`
        + `\nDeployment rows: ${JSON.stringify(deployments)}`
        + `\nTask output:\n${taskOutput}`
    ).toHaveLength(1);
  });

  test.afterAll(async () => {
    const gamespaceIds = await cleanupMoodleTopomojoDeployments([activity.instanceId], [studentUserId]);
    for (const gamespaceId of gamespaceIds) {
      await deleteGamespace(topoToken, gamespaceId);
    }
  });

  test('the activity page renders and offers the challenge', async ({ moodleDemoUserPage: page }) => {
    await openActivity(page);
    await expectNoMoodleError(page);

    await expect(page.getByRole('heading', { name: activity.name })).toBeVisible();

    // questionorder is set and the deploy left an open attempt, so view.php offers
    // the challenge link. This is the entry point into the question-less attempt.
    await expect(page.locator('.topomojo-challenge-link')).toBeVisible();
  });

  test('the challenge page shows the questions the activity has', async ({
    moodleDemoUserPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/mod/topomojo/challenge.php?id=${topomojoActivityId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // challenge.php reaches its default branch and asks the attempt for its question
    // usage. This used to be the crash, and then the null-safe dead end below it.
    await expectNoMoodleError(page);

    // `$openAttempt->get_quba()` is a real usage now, so the challenge branch runs
    // and renders the response form rather than treating the student as having no
    // attempt at all. The notice is what they used to get instead.
    await expect(page.locator('#review_notavailable')).toHaveCount(0);

    const form = page.locator('#topomojoview');
    await expect(form).toBeVisible();
    const questions = page.locator('#topomojoview .que');
    const attempts = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    const usage = await getMoodleQuestionUsage(attempts[0].questionUsageId);
    // Every slot in the usage is rendered, not just the first, and each is
    // answerable: an input the student can actually type a flag into.
    expect(usage.slots.length, 'the activity should have imported at least one question').toBeGreaterThan(0);
    await expect(questions).toHaveCount(usage.slots.length);
    await expect(questions.first().locator('input[type="text"], textarea').first()).toBeEditable();

    // Submitting the answers is what closes the attempt, so the form has to carry
    // the slots it is submitting for.
    await expect(form.locator('input[name="slots"]')).toHaveValue(attempts[0].layout!);
  });

  test('ending the lab closes the attempt and grades it zero', async ({ moodleDemoUserPage: page }) => {
    await openActivity(page);

    const before = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    expect(before[0].state).toBe('inprogress');

    // End Lab is guarded by a confirmation modal that sets the hidden
    // stop_confirmed flag and resubmits, so the click alone does nothing.
    await page.locator('#end_button').click();
    const modal = page.locator('.modal-dialog', { hasText: 'End Lab' }).last();
    await expect(modal).toBeVisible();

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
      modal.getByRole('button', { name: 'Confirm', exact: true }).click(),
    ]);

    // The stop branch closes the attempt and then grades it. Both steps reach for
    // the question usage, and grading a question-less attempt used to fatal on it.
    await expectNoMoodleError(page);

    const after = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    expect(after).toHaveLength(1);
    expect(after[0].state, 'ending the lab should close the attempt').toBe('finished');

    // Zero, because the test above only looked at the questions and never answered
    // one — not because there was nothing to answer. The distinction is the whole
    // point of the fix, so it is pinned from the other side: the usage the grade was
    // computed over still holds the activity's questions.
    expect(after[0].score).toBe(0);
    const usage = await getMoodleQuestionUsage(after[0].questionUsageId);
    expect(usage.slots.length, 'the graded attempt should have had questions to answer').toBeGreaterThan(0);

    const client = await connectMoodleDatabase();
    try {
      const gradebook = await client.query<{ finalgrade: string | null; rawgrademax: string }>(
        `SELECT gg.finalgrade, gg.rawgrademax
           FROM mdl_grade_grades gg
           JOIN mdl_grade_items gi ON gi.id = gg.itemid
          WHERE gi.itemtype = 'mod' AND gi.itemmodule = 'topomojo'
            AND gi.iteminstance = $1 AND gi.itemnumber = 0
            AND gg.userid = $2`,
        [activity.instanceId, studentUserId]
      );
      expect(gradebook.rowCount, 'grading should have written a gradebook entry').toBe(1);
      expect(Number(gradebook.rows[0].finalgrade)).toBe(0);
      expect(Number(gradebook.rows[0].rawgrademax)).toBe(activity.grade);
    } finally {
      await client.end();
    }
  });
});
