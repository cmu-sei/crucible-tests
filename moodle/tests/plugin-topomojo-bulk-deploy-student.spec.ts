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
 * The last test then takes the closed, zero-graded attempt the others leave behind
 * and has an instructor override a mark on it, which is the other half of the same
 * grading path: recalculating a student's grade from somebody else's session.
 *
 * A pre-existing Keycloak account is borrowed rather than created, because the
 * login goes through the identity provider and a DB-seeded Moodle user has no
 * credentials there. Everything the deploy leaves on that account is removed in
 * teardown, as is the course enrolment when this run is what made it; the account
 * itself is left alone.
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
  resolveMoodleLabActivityCmid,
} from '../db-helpers';
import { queueMoodleTopomojoBulkDeploy, runMoodleAdhocTask } from '../cli-helpers';
import {
  DemoUserEnrolment,
  demoUsername,
  enrolMoodleDemoUser,
  resolveMoodleDemoUserId,
  unenrolMoodleDemoUser,
} from '../demo-user-helpers';
import { deleteGamespace, getTopoMojoAdminToken } from '../../topomojo-helpers';

// Resolved in beforeAll rather than hardcoded: the course-module id differs
// between the Moodle 5.0 and 5.2 containers and changes whenever the demo course
// is reseeded.
let topomojoActivityId: number;

// These tests drive a live TopoMojo: each run registers real gamespaces and holds
// real VMs. They also share one Moodle instance, so a second browser project would
// double the VM cost and — where a test borrows an existing account rather than
// seeding one — race the first project for the same records. One project is enough:
// what is under test is the plugin's server-side behaviour, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

const BULKDEPLOY_TASK = '\\mod_topomojo\\task\\bulkdeploy_run';
async function openActivity(page: Page): Promise<void> {
  // view.php asks TopoMojo for the gamespace and its VMs before it renders, so the
  // page is only as quick as the lab it is reporting on.
  await page.goto(`${Services.Moodle}/mod/topomojo/view.php?id=${topomojoActivityId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
}

/**
 * Every grade the plugin has stored for an activity, keyed by user.
 *
 * Read as a whole rather than for one user: what the grader must not do is write a
 * grade for somebody who has no attempts, and that shows up as a user appearing in
 * this table who was not in it before.
 */
async function readTopomojoGrades(topomojoId: number): Promise<Map<number, number>> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{ userid: string; grade: string }>(
      `SELECT userid, grade FROM mdl_topomojo_grades WHERE topomojoid = $1`,
      [topomojoId]
    );
    return new Map(result.rows.map(row => [Number(row.userid), Number(row.grade)]));
  } finally {
    await client.end();
  }
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
  let enrolment: DemoUserEnrolment;
  let topoToken: string;

  test.beforeAll(async () => {
    topomojoActivityId = await resolveMoodleLabActivityCmid('topomojo');
    topoToken = await getTopoMojoAdminToken();
    activity = await getMoodleTopomojoActivity(topomojoActivityId);
    studentUserId = resolveMoodleDemoUserId();

    // The deploy writes an attempt for the student whether or not they are in the
    // course, but the pages under test are the student's own view of the activity,
    // and an unenrolled user is sent to the enrolment page instead of reaching it.
    enrolment = enrolMoodleDemoUser('topomojo', topomojoActivityId, studentUserId);

    // Start from a clean slate: an attempt left over from an earlier run would be
    // picked up as the open attempt and the deploy below would be skipped.
    const stale = await cleanupMoodleTopomojoDeployments([activity.instanceId], [studentUserId]);
    for (const gamespaceId of stale) {
      await deleteGamespace(topoToken, gamespaceId);
    }

    const jobId = queueMoodleTopomojoBulkDeploy(topomojoActivityId, [studentUserId]);
    // Ordinary cron runs inside the Moodle container, so the queued task is a race:
    // whichever of cron and this CLI claims it first is the one that runs it, and
    // the loser reports "Ran 0 adhoc tasks found" having done nothing. Either way
    // the deploy happens, so what is waited on below is the attempt appearing rather
    // than this command being the one to create it.
    const taskOutput = runMoodleAdhocTask(BULKDEPLOY_TASK);

    // The task records a per-user failure and still completes successfully, so its
    // own output and the rows it wrote are carried into the failure message —
    // otherwise a TopoMojo error, a skipped user and a task nobody has got to yet
    // all look identical from here. Teardown deletes those rows, so this is the only
    // chance to see them.
    let attempts = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    const deadline = Date.now() + 180_000;
    while (attempts.length === 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 2_000));
      attempts = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    }

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
    // Guarded: beforeAll can fail before the enrolment is made.
    if (enrolment) {
      unenrolMoodleDemoUser(enrolment, studentUserId);
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

  test('an instructor overriding a mark regrades the student and not themselves', async ({
    moodleAdminPage: page,
  }) => {
    const [attempt] = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    // The save button is only rendered for a closed attempt, which is what the test
    // above leaves behind, graded zero for answering nothing.
    expect(attempt.state, 'the override is only offered on a closed attempt').toBe('finished');
    expect(attempt.score).toBe(0);

    const usage = await getMoodleQuestionUsage(attempt.questionUsageId);
    const gradedBefore = await readTopomojoGrades(activity.instanceId);

    await page.goto(`${Services.Moodle}/mod/topomojo/viewattempt.php?a=${attempt.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expectNoMoodleError(page);

    // Instructor-only, and only rendered for a question that carries a max mark, so
    // its presence is the first half of what is under test.
    const markInput = page.locator('input[name$="-mark"]').first();
    await expect(markInput).toBeVisible();

    // Full marks on the first question and the rest left unmarked: the smallest
    // override that has to move the grade off zero, and one whose arithmetic is
    // predictable however many questions the challenge turns out to have.
    const awarded = usage.slots[0].maxMark;
    const available = usage.slots.reduce((total, slot) => total + slot.maxMark, 0);
    const expected = (awarded / available) * activity.grade;
    expect(expected, 'the override has to be able to move the grade').toBeGreaterThan(0);
    await markInput.fill(String(awarded));

    // One form per question, each posting its own slot back to viewattempt.php.
    const form = markInput.locator('xpath=ancestor::form[1]');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }),
      form.locator('input[type="submit"][name="submit"]').click(),
    ]);
    await expectNoMoodleError(page);

    // savecomment saves the mark through the question engine and then regrades. The
    // grading method is applied to the attempt's own user, so the student's grade is
    // recomputed from the student's attempts.
    const [regraded] = await getMoodleTopomojoAttempts(activity.instanceId, [studentUserId]);
    expect(regraded.id, 'the override should have regraded the attempt it was made on').toBe(attempt.id);
    expect(regraded.score!).toBeCloseTo(expected, 2);

    const gradedAfter = await readTopomojoGrades(activity.instanceId);
    expect(gradedAfter.get(studentUserId)).toBeCloseTo(expected, 2);

    // And nobody else acquires a grade for it. The instructor reviewing an attempt
    // has none of their own, and used to be the user the grading method was applied
    // to: the student's grade was recomputed from the reviewer's empty list of
    // attempts and stored over what the student had earned.
    const newlyGraded = [...gradedAfter.keys()].filter(
      userId => userId !== studentUserId && !gradedBefore.has(userId)
    );
    expect(newlyGraded, 'reviewing an attempt should not grade the reviewer').toEqual([]);

    // The gradebook is what the course actually reads, and process_attempt() only
    // reaches it once the grading method has produced a grade to send.
    const client = await connectMoodleDatabase();
    try {
      const gradebook = await client.query<{ finalgrade: string | null }>(
        `SELECT gg.finalgrade
           FROM mdl_grade_grades gg
           JOIN mdl_grade_items gi ON gi.id = gg.itemid
          WHERE gi.itemtype = 'mod' AND gi.itemmodule = 'topomojo'
            AND gi.iteminstance = $1 AND gi.itemnumber = 0
            AND gg.userid = $2`,
        [activity.instanceId, studentUserId]
      );
      expect(gradebook.rowCount).toBe(1);
      expect(Number(gradebook.rows[0].finalgrade)).toBeCloseTo(expected, 2);
    } finally {
      await client.end();
    }
  });
});
