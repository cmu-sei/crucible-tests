// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * End-to-end bulk deploy against a live TopoMojo, covering the paths the plugin's
 * PHPUnit suite can only reach through a fake HTTP client:
 *
 *  - Deploying to several users at once and rendering every resulting row on the
 *    management page, including the gamespace id and expiry the launcher wrote.
 *  - What the attempt a bulk deploy created actually looks like in the database,
 *    which is where the missing question usage shows up.
 *
 * Real gamespaces mean real VMs, so the deploy is kept to two users and every
 * gamespace is deleted in teardown even when the assertions fail.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleTopomojoParticipants,
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

  test('a bulk-deployed attempt is created without a question usage', async () => {
    const attempts = await getMoodleTopomojoAttempts(
      activity.instanceId,
      participants.map(p => p.userId)
    );
    expect(attempts.length, 'the deploy test must have run first').toBe(PARTICIPANT_COUNT);

    expect(activity.questionorder, 'this activity should have imported challenge questions').toBeTruthy();

    for (const attempt of attempts) {
      expect(attempt.state).toBe('inprogress');

      // Pending upstream: launcher::create_attempt_for_user() bare-inserts the
      // attempt rather than going through topomojo::init_attempt(), so no question
      // usage is ever created and questionusageid stays at its column default of
      // 0. The attempt therefore has no questions to answer or grade even though
      // the activity has a question order. Asserted as the current behaviour so
      // the fix flips this expectation rather than quietly passing.
      expect(attempt.questionUsageId, 'bulk-deployed attempts carry no question usage').toBe(0);

      // Pending upstream: the launchpoint URL is minted only by
      // POST /api/gamespace, but create_attempt_for_user() reads it off the poll
      // body, which never carries it. See plugin-topomojo-gamespace-contract.spec.ts.
      expect(attempt.launchpointUrl ?? '', 'bulk-deployed attempts store no launchpoint URL').toBe('');
    }
  });

  test('the management page offers no attempt review for a question-less attempt', async ({
    moodleAdminPage: page,
  }) => {
    await openManagePage(page);

    for (const participant of participants) {
      const row = page.locator(`${USERS_TABLE} tr[data-userid="${participant.userId}"]`);

      // format_user_state() only links viewattempt.php when the attempt has a
      // question usage, which is the visible consequence of the gap above: an
      // instructor has nothing to review. Guards against the alternative failure
      // mode of linking anyway and handing viewattempt.php a null usage.
      await expect(row.locator('.cell-actions')).toHaveText('─');
      await expect(row.locator('.cell-actions').getByRole('link', { name: /View Attempt/i })).toHaveCount(0);
    }
  });
});
