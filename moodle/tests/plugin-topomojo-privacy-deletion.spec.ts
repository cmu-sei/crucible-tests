// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * Deleting a user's data must end the gamespace they are still running.
 *
 * mod_topomojo's privacy provider removes the user's attempts and bulk-deploy
 * rows, which are the only place Moodle records the gamespace id. A provider that
 * dropped them without completing the gamespace would leave its VMs running in
 * TopoMojo with nothing in Moodle able to find them again.
 *
 * The gamespace is started for a disposable user through the real bulk-deploy
 * task, and the deletion goes through tool_dataprivacy's own request pipeline, so
 * the provider is reached the way a privacy officer reaches it. TopoMojo is then
 * asked directly, with the admin API key, what became of the gamespace.
 */

import { test, expect } from '../fixtures';
import {
  cleanupMoodleTopomojoParticipants,
  getMoodleTopomojoActivity,
  getMoodleTopomojoAttempts,
  getMoodleTopomojoDeployments,
  MoodleTopomojoActivity,
  MoodleTopomojoParticipant,
  resolveMoodleLabActivityCmid,
  seedMoodleTopomojoParticipants,
} from '../db-helpers';
import {
  deleteMoodleUserDataViaPrivacyRequest,
  queueMoodleTopomojoBulkDeploy,
  runMoodleAdhocTask,
} from '../cli-helpers';
import { deleteGamespace, getGamespace, getTopoMojoAdminToken } from '../../topomojo-helpers';

// Each run holds a real VM in TopoMojo, so a second browser project would only
// double the cost. What is under test is the plugin's server-side delete path,
// not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

const BULKDEPLOY_TASK = '\\mod_topomojo\\task\\bulkdeploy_run';

/** tool_dataprivacy api::DATAREQUEST_STATUS_DELETED, where a processed delete request ends. */
const DATAREQUEST_STATUS_DELETED = 10;

test.describe('mod_topomojo privacy deletion ends running gamespaces', () => {
  test.describe.configure({ mode: 'serial', timeout: 10 * 60_000 });

  let topomojoCmid: number;
  let activity: MoodleTopomojoActivity;
  let topoToken: string;
  let seeded: MoodleTopomojoParticipant[] = [];
  // Held separately from the Moodle rows, because the deletion under test is what
  // removes those rows - cleanup cannot recover the ids from them afterwards.
  let gamespaceIds: string[] = [];

  test.beforeAll(async () => {
    topomojoCmid = await resolveMoodleLabActivityCmid('topomojo');
    topoToken = await getTopoMojoAdminToken();
    activity = await getMoodleTopomojoActivity(topomojoCmid);
  });

  test.afterEach(async () => {
    gamespaceIds.push(...(await cleanupMoodleTopomojoParticipants(seeded)));
    seeded = [];
    for (const gamespaceId of new Set(gamespaceIds)) {
      await deleteGamespace(topoToken, gamespaceId);
    }
    gamespaceIds = [];
  });

  test('deleting a user completes their gamespace and removes their rows', async () => {
    const [participant] = await seedMoodleTopomojoParticipants(topomojoCmid, 1);
    seeded.push(participant);

    queueMoodleTopomojoBulkDeploy(topomojoCmid, [participant.userId]);
    // The launcher waits for the gamespace to be active with its VMs before the task returns.
    runMoodleAdhocTask(BULKDEPLOY_TASK);

    const deployments = await getMoodleTopomojoDeployments([activity.instanceId], [participant.userId]);
    expect(deployments).toHaveLength(1);
    const [deployment] = deployments;
    if (deployment.gamespaceId) {
      gamespaceIds.push(deployment.gamespaceId);
    }
    expect(deployment.status, `deploy failed: ${deployment.errorMessage}`).toBe('ready');
    const gamespaceId = deployment.gamespaceId as string;

    const attempts = await getMoodleTopomojoAttempts(activity.instanceId, [participant.userId]);
    expect(attempts.map(a => a.eventId)).toEqual([gamespaceId]);

    const before = await getGamespace(topoToken, gamespaceId);
    expect(before.isActive, 'TopoMojo reports the gamespace running before deletion').toBe(true);

    expect(await deleteMoodleUserDataViaPrivacyRequest(participant.userId)).toBe(DATAREQUEST_STATUS_DELETED);

    const after = await getGamespace(topoToken, gamespaceId);
    expect(after.isActive, `gamespace ${gamespaceId} after deletion`).toBe(false);
    expect(after.endTime, 'completing a gamespace stamps its end time').toBeTruthy();

    expect(await getMoodleTopomojoAttempts(activity.instanceId, [participant.userId])).toEqual([]);
    expect(await getMoodleTopomojoDeployments([activity.instanceId], [participant.userId])).toEqual([]);
  });
});
