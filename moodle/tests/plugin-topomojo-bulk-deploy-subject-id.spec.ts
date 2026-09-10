// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * The undocumented length ceiling on a bulk-deployed player's subject id.
 *
 * `payload_builder::build()` sends the part of a user's email address before the
 * `@` as the gamespace player's `subjectId`. TopoMojo stores that in a
 * `varchar(36)` column, so one character more and the gamespace POST fails inside
 * TopoMojo's database layer. The plugin does not check the length, and TopoMojo
 * answers with a generic 500, so the instructor is left with a failed row and
 * nothing that names the cause.
 *
 * Both sides of the boundary are exercised, because "36 is fine, 37 is not" is the
 * whole claim. Only the passing side costs a VM, and it is released in teardown.
 */

import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleTopomojoParticipants,
  getMoodleTopomojoActivity,
  getMoodleTopomojoAttempts,
  getMoodleTopomojoDeployments,
  MoodleTopomojoActivity,
  MoodleTopomojoParticipant,
  seedMoodleTopomojoParticipants,
  TOPOMOJO_SUBJECT_ID_MAX_LENGTH,
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

test.describe('mod_topomojo bulk deploy subject id length', () => {
  test.describe.configure({ mode: 'serial', timeout: 10 * 60_000 });

  let activity: MoodleTopomojoActivity;
  let topoToken: string;
  let seeded: MoodleTopomojoParticipant[] = [];

  test.beforeAll(async () => {
    topoToken = await getTopoMojoAdminToken();
    activity = await getMoodleTopomojoActivity(topomojoActivityId);
  });

  test.afterAll(async () => {
    const gamespaceIds = await cleanupMoodleTopomojoParticipants(seeded);
    seeded = [];
    for (const gamespaceId of gamespaceIds) {
      await deleteGamespace(topoToken, gamespaceId);
    }
  });

  /** Seeds one participant at a given subject-id length and deploys to them. */
  async function deployAtLength(length: number): Promise<MoodleTopomojoParticipant> {
    const [participant] = await seedMoodleTopomojoParticipants(topomojoActivityId, 1, length);
    seeded.push(participant);

    expect(participant.email.split('@')[0]).toHaveLength(length);

    queueMoodleTopomojoBulkDeploy(topomojoActivityId, [participant.userId]);
    runMoodleAdhocTask(BULKDEPLOY_TASK);
    return participant;
  }

  test('a subject id at the limit deploys', async () => {
    const participant = await deployAtLength(TOPOMOJO_SUBJECT_ID_MAX_LENGTH);

    const deployments = await getMoodleTopomojoDeployments([activity.instanceId], [participant.userId]);
    expect(deployments).toHaveLength(1);
    expect(deployments[0].errorMessage, 'a 36-character subject id is accepted').toBeNull();
    expect(deployments[0].gamespaceId).toMatch(/^[0-9a-f]{32}$/);

    const attempts = await getMoodleTopomojoAttempts(activity.instanceId, [participant.userId]);
    expect(attempts, 'the deploy should have created an attempt').toHaveLength(1);
  });

  test('a subject id one character over the limit fails with an opaque error', async () => {
    const participant = await deployAtLength(TOPOMOJO_SUBJECT_ID_MAX_LENGTH + 1);

    const deployments = await getMoodleTopomojoDeployments([activity.instanceId], [participant.userId]);
    expect(deployments).toHaveLength(1);

    // Pending upstream: nothing checks the length before the POST, so TopoMojo
    // rejects it in its database layer — Players.SubjectId is varchar(36) — and
    // answers 500 with a body that names neither the field nor the limit. The
    // plugin should validate or truncate the subject id, and TopoMojo should treat
    // an over-long one as a bad request. Asserted as-is so a fix on either side
    // flips this expectation.
    expect(deployments[0].status, 'an over-long subject id fails the deploy').toBe('failed');
    expect(deployments[0].errorMessage).toContain('HTTP 500');
    expect(deployments[0].gamespaceId, 'no gamespace is created, so no VM is held').toBeNull();

    const attempts = await getMoodleTopomojoAttempts(activity.instanceId, [participant.userId]);
    expect(attempts, 'a failed deploy should not leave an attempt behind').toHaveLength(0);
  });

  test('the management page reports the failure but not its cause', async ({ moodleAdminPage: page }) => {
    const failed = seeded[seeded.length - 1];
    expect(failed, 'the failing deploy test must have run first').toBeDefined();

    await page.goto(`${Services.Moodle}/mod/topomojo/manage.php?id=${topomojoActivityId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const row = page.locator(`.mod-topomojo-users-table tr[data-userid="${failed.userId}"]`);
    await expect(row).toHaveAttribute('data-status', 'failed');
    await expect(row.locator('.cell-status')).toContainText('Failed');
    await expect(row.locator('.cell-gamespace')).toHaveText('─');

    // The error is offered behind a popover on the status cell, which is the only
    // place an instructor can see why the deploy failed.
    const help = row.locator('.cell-status .mod-topomojo-status-help');
    await expect(help).toHaveCount(1);

    // Pending upstream: what that popover carries is TopoMojo's generic message, so
    // the instructor is told the deploy failed with a 500 and nothing about the
    // email address that caused it.
    await expect(help).toHaveAttribute('data-bs-content', /HTTP 500/);
  });
});
