// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * End-to-end bulk deploy against a live TopoMojo, covering the paths the plugin's
 * PHPUnit suite can only reach through a fake HTTP client:
 *
 *  - Deploying to several users at once and rendering every resulting row on the
 *    management page, including the gamespace id and expiry the launcher wrote.
 *  - What the attempt a bulk deploy created actually looks like in the database:
 *    a real question usage over the deployed variant's questions, which is what
 *    makes the attempt answerable and gradeable at all.
 *
 * Real gamespaces mean real VMs, so the deploy is kept to two users and every
 * gamespace is deleted in teardown even when the assertions fail.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleTopomojoParticipants,
  getMoodleQuestionUsage,
  getMoodleTopomojoActivity,
  getMoodleTopomojoAttempts,
  getMoodleTopomojoDeployments,
  MoodleTopomojoActivity,
  MoodleTopomojoParticipant,
  seedMoodleTopomojoParticipants,
} from '../db-helpers';
import { runMoodleAdhocTask } from '../cli-helpers';
import { deleteGamespace, getTopoMojoAdminToken } from '../../topomojo-helpers';

const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

// These tests drive a live TopoMojo: each run registers real gamespaces and holds
// real VMs. They also share one Moodle instance, so a second browser project would
// double the VM cost and — where a test borrows an existing account rather than
// seeding one — race the first project for the same records. One project is enough:
// what is under test is the plugin's server-side behaviour, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

const BULKDEPLOY_TASK = '\\mod_topomojo\\task\\bulkdeploy_run';
const USERS_TABLE = '.mod-topomojo-users-table';

// Two is enough to prove the loop renders every row rather than only the first,
// and keeps the VM cost of a test run down.
const PARTICIPANT_COUNT = 2;

async function openManagePage(page: Page): Promise<void> {
  await page.goto(`${Services.Moodle}/mod/topomojo/manage.php?id=${topomojoActivityId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.getByRole('heading', { name: 'Manage Deployments' })).toBeVisible();
}

test.describe('mod_topomojo bulk deploy', () => {
  // Deploying real gamespaces takes minutes: the POST, then the wait phase polling
  // until TopoMojo reports VMs up.
  test.describe.configure({ mode: 'serial', timeout: 15 * 60_000 });

  let activity: MoodleTopomojoActivity;
  let participants: MoodleTopomojoParticipant[] = [];
  let topoToken: string;

  test.beforeAll(async () => {
    topoToken = await getTopoMojoAdminToken();
    activity = await getMoodleTopomojoActivity(topomojoActivityId);
    participants = await seedMoodleTopomojoParticipants(topomojoActivityId, PARTICIPANT_COUNT);
  });

  test.afterAll(async () => {
    // Drop the Moodle records first: the cleanup reports back which gamespaces
    // were attached to them, which is what has to be released from TopoMojo.
    const gamespaceIds = await cleanupMoodleTopomojoParticipants(participants);
    participants = [];
    for (const gamespaceId of gamespaceIds) {
      await deleteGamespace(topoToken, gamespaceId);
    }
  });

  test('deploys to every selected user and renders a row for each', async ({ moodleAdminPage: page }) => {
    await openManagePage(page);

    for (const participant of participants) {
      const row = page.locator(`${USERS_TABLE} tr[data-userid="${participant.userId}"]`);
      await expect(row, `${participant.username} should be listed as an enrolled user`).toHaveCount(1);
      // Nothing has been deployed to them yet.
      await expect(row).toHaveAttribute('data-status', 'none');
      await row.locator('.user-checkbox').check();
    }

    const deployButton = page.locator('#deploy-selected-btn');
    // The button reports the count it is about to act on, and is disabled until
    // something deployable is selected.
    await expect(deployButton).toBeEnabled();
    await expect(deployButton).toHaveText(`Deploy Selected (${PARTICIPANT_COUNT})`);
    await deployButton.click();

    const dialog = page.locator('.modal-dialog', { hasText: `Deploy Selected (${PARTICIPANT_COUNT})` }).last();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#deploy-batchsize-input')).toHaveAttribute('min', '1');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      dialog.getByRole('button', { name: 'Deploy Now', exact: true }).click(),
    ]);

    // Queued, not yet run: manage_action.php creates the job and an adhoc task.
    for (const participant of participants) {
      await expect(page.locator(`${USERS_TABLE} tr[data-userid="${participant.userId}"]`)).toHaveAttribute(
        'data-status',
        'pending'
      );
    }

    // Run the queued task rather than waiting for cron, so the assertions below
    // are about the launcher's output and not about scheduling luck.
    const taskOutput = runMoodleAdhocTask(BULKDEPLOY_TASK);

    await openManagePage(page);

    const attempts = await getMoodleTopomojoAttempts(
      activity.instanceId,
      participants.map(p => p.userId)
    );
    // The task records a per-user failure and still completes successfully, so both
    // its output and the rows it wrote are carried into the failure message —
    // otherwise a TopoMojo error, a skipped user and a task that was never queued
    // all look identical from here.
    const deployments = await getMoodleTopomojoDeployments(
      [activity.instanceId],
      participants.map(p => p.userId)
    );
    const diagnostics =
      `\nParticipants: ${JSON.stringify(participants.map(p => ({ userId: p.userId, email: p.email })))}`
      + `\nDeployment rows: ${JSON.stringify(deployments)}`
      + `\nAttempts: ${JSON.stringify(attempts)}`
      + `\nTask output:\n${taskOutput}`;

    expect(
      attempts,
      `the launcher should have created one attempt per deployed user.${diagnostics}`
    ).toHaveLength(PARTICIPANT_COUNT);

    for (const participant of participants) {
      const row = page.locator(`${USERS_TABLE} tr[data-userid="${participant.userId}"]`);
      const attempt = attempts.find(a => a.userId === participant.userId);
      expect(attempt, `${participant.username} should have an attempt.${diagnostics}`).toBeDefined();

      // A ready deploy with an open attempt renders as In Progress.
      await expect(row).toHaveAttribute('data-status', 'in progress');
      await expect(row.locator('.cell-status')).toContainText('In Progress');
      await expect(row).toContainText(participant.displayName);

      // The gamespace column shows what the launcher recorded, not a placeholder.
      await expect(row.locator('.cell-gamespace')).toHaveText(attempt!.eventId!);
      expect(attempt!.eventId, 'attempt should carry the gamespace id').toMatch(/^[0-9a-f]{32}$/);

      // resolve_endtime() must produce a future timestamp: close_attempts reaps
      // anything whose endtime has passed, so 0 or null would kill the attempt on
      // the next cron run.
      expect(attempt!.endtime).toBeGreaterThan(Math.floor(Date.now() / 1000));
      await expect(row.locator('.cell-end-time')).not.toHaveText('─');

      // Variant is stored 1-based from TopoMojo's 0-based report, so a deployed
      // attempt can never be variant 0.
      expect(attempt!.variant).toBeGreaterThanOrEqual(1);
    }
  });

  test('a bulk-deployed attempt gets a question usage over the deployed variant', async () => {
    const attempts = await getMoodleTopomojoAttempts(
      activity.instanceId,
      participants.map(p => p.userId)
    );
    expect(attempts.length, 'the deploy test must have run first').toBe(PARTICIPANT_COUNT);

    expect(activity.questionorder, 'this activity should have imported challenge questions').toBeTruthy();

    const usageIds = new Set<number>();

    for (const attempt of attempts) {
      expect(attempt.state).toBe('inprogress');

      // launcher::create_attempt_for_user() builds the attempt through
      // topomojo_attempt, whose constructor creates the question usage. It used to
      // insert the row by hand, which left questionusageid at its column default of
      // 0 — and nothing creates one later, so the student was shown "There are no
      // challenge questions to review" and graded 0 on an activity with questions.
      expect(attempt.questionUsageId, 'a bulk-deployed attempt must have a question usage').toBeGreaterThan(0);

      // Each user needs their own usage: a shared one would mean one student's
      // answers grading another's attempt.
      expect(usageIds.has(attempt.questionUsageId), 'question usages must not be shared between users').toBe(false);
      usageIds.add(attempt.questionUsageId);

      // A usage id alone only proves a row exists. The slots are what make the
      // attempt answerable, and layout is what names them on the attempt.
      const usage = await getMoodleQuestionUsage(attempt.questionUsageId);
      expect(usage.component).toBe('mod_topomojo');
      expect(usage.preferredBehaviour, 'the usage must ask for the activity behaviour').toBe(
        activity.preferredBehaviour
      );
      expect(usage.slots.length, 'the usage should hold the activity\'s challenge questions').toBeGreaterThan(0);
      expect(attempt.layout).toBe(usage.slots.map(s => s.slot).join(','));
      for (const slot of usage.slots) {
        expect(slot.questionType, 'challenge questions are imported as mojomatch').toBe('mojomatch');
        // The qtype supplies its own behaviour, so this is not the usage's preferred
        // one — deferred feedback would grade the flags with the wrong comparison.
        expect(slot.behaviour, 'mojomatch questions must be graded by qbehaviour_mojomatch').toBe('mojomatch');
        expect(slot.maxMark, 'a slot worth nothing cannot contribute to the grade').toBeGreaterThan(0);
      }

      // Pending upstream: the launchpoint URL is minted only by the register
      // POST, but create_attempt_for_user() reads it off the poll body, which
      // never carries it. The stored empty string is not a value to be fixed up
      // at deploy time — the ticket in that URL expires in 180s, so it cannot be
      // stored at all and has to be minted when the link is clicked. This
      // assertion therefore stands even after the fix; what changes is that the
      // launch paths stop reading the column. See
      // plugin-topomojo-gamespace-contract.spec.ts.
      expect(attempt.launchpointUrl ?? '', 'bulk-deployed attempts store no launchpoint URL').toBe('');
    }
  });

  test('the management page offers attempt review for every deployed user', async ({
    moodleAdminPage: page,
  }) => {
    await openManagePage(page);

    const attempts = await getMoodleTopomojoAttempts(
      activity.instanceId,
      participants.map(p => p.userId)
    );

    for (const participant of participants) {
      const row = page.locator(`${USERS_TABLE} tr[data-userid="${participant.userId}"]`);
      const attempt = attempts.find(a => a.userId === participant.userId);

      // format_user_state() only links viewattempt.php when the attempt has a
      // question usage, so this is the instructor-side consequence of the fix: the
      // dash the cell used to hold is now a review link. It points at the user's own
      // attempt, not whichever one the page happened to look up first.
      const link = row.locator('.cell-actions').getByRole('link', { name: 'View Attempt' });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', new RegExp(`a=${attempt!.id}(&|$)`));
      await expect(row.locator('.cell-actions')).not.toHaveText('─');
    }
  });
});
