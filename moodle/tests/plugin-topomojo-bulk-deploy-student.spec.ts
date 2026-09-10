// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * What a student actually gets when they open a lab that was bulk-deployed to
 * them, and what it grades to.
 *
 * The activity has imported challenge questions, but a bulk-deployed attempt is
 * inserted without a question usage. Every page that reaches for that usage has to
 * cope with a null one — which is the crash this used to be — and what they cope
 * their way to is a student who is shown no questions and then graded zero for not
 * answering them. Both halves are asserted: that the pages render at all, and what
 * the student's grade ends up as.
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

  test('the challenge page shows the no-challenge notice instead of failing', async ({
    moodleDemoUserPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/mod/topomojo/challenge.php?id=${topomojoActivityId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // This is the crash: challenge.php reaches its default branch and asks the
    // attempt for its question usage, which a bulk-deployed attempt does not have.
    // The page has to survive a null one.
    await expectNoMoodleError(page);

    // Pending upstream: what it survives to is a dead end. `$openAttempt->get_quba()`
    // is null, so the whole challenge branch is skipped and the student is treated
    // as having no attempt at all — they get the no-challenge notice and a way back,
    // not the questions the activity has. Asserted as the current behaviour so a
    // fix that backfills the question usage flips this expectation.
    const notice = page.locator('#review_notavailable');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText('There are no challenge questions to review.');
    await expect(page.getByRole('button', { name: 'Return' })).toBeVisible();

    // No response form at all, so there is nothing to answer and nothing to submit
    // from here: ending the lab on the activity page is the student's only exit.
    await expect(page.locator('#topomojoview')).toHaveCount(0);
    await expect(page.locator('.que')).toHaveCount(0);
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
    // the question usage, which is null here, and grading a question-less attempt
    // used to fatal on it.
    await expectNoMoodleError(page);

    const after = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    expect(after).toHaveLength(1);
    expect(after[0].state, 'ending the lab should close the attempt').toBe('finished');

    // Pending upstream: the attempt grades to 0 out of the activity's maximum
    // because there were never any questions to answer. Closing and grading no
    // longer crashes, but a student who was bulk-deployed to still ends up with a
    // zero they had no way to avoid. Asserted so the fix changes this number.
    expect(after[0].score).toBe(0);

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
