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
 *
 * Deleting the whole activity runs topomojo_delete_all_attempts(), which must end
 * the gamespace of every unfinished attempt, not only those a bulk deployment
 * still tracks. That is covered against a throwaway activity, since deleting the
 * demo one would take everyone's data with it.
 */

import { test, expect } from '../fixtures';
import {
  cleanupMoodleTopomojoParticipants,
  connectMoodleDatabase,
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
  runMoodlePhp,
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
  let throwawayCmid: number | undefined;

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
    if (throwawayCmid !== undefined) {
      runMoodlePhp(
        `require_once($CFG->dirroot . '/course/lib.php');`
        + ` if ($DB->record_exists('course_modules', ['id' => ${throwawayCmid}])) {`
        + ` course_delete_module(${throwawayCmid}); }`
      );
      throwawayCmid = undefined;
    }
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
  test('deleting an activity completes the gamespace of an unfinished attempt', async () => {
    // A hidden copy of the demo activity, on the same workspace, in the same course.
    // importchallenge is off so creating it does not call TopoMojo; a gamespace
    // deploys without the activity holding any questions.
    throwawayCmid = Number(runMoodlePhp(
      `require_once($CFG->dirroot . '/course/lib.php'); \\core\\session\\manager::set_user(get_admin());`
      + ` $cm = get_coursemodule_from_id('topomojo', ${topomojoCmid}, 0, false, MUST_EXIST);`
      + ` $m = $DB->get_record('topomojo', ['id' => $cm->instance], '*', MUST_EXIST);`
      + ` unset($m->id, $m->intro, $m->introformat, $m->timemodified);`
      + ` $m->modulename = 'topomojo'; $m->course = $cm->course; $m->section = 0; $m->visible = 0;`
      + ` $m->name = 'E2E privacy throwaway ' . time(); $m->importchallenge = 0; $m->questionorder = '';`
      // create_module() insists on the form's editor field rather than intro itself.
      + ` $m->introeditor = ['text' => '', 'format' => FORMAT_HTML, 'itemid' => 0];`
      + ` echo create_module($m)->coursemodule;`
    ));
    expect(throwawayCmid).toBeGreaterThan(0);
    const throwaway = await getMoodleTopomojoActivity(throwawayCmid);

    const [participant] = await seedMoodleTopomojoParticipants(throwawayCmid, 1);
    seeded.push(participant);
    queueMoodleTopomojoBulkDeploy(throwawayCmid, [participant.userId]);
    runMoodleAdhocTask(BULKDEPLOY_TASK);

    const [deployment] = await getMoodleTopomojoDeployments([throwaway.instanceId], [participant.userId]);
    if (deployment?.gamespaceId) {
      gamespaceIds.push(deployment.gamespaceId);
    }
    expect(deployment?.status, `deploy failed: ${deployment?.errorMessage}`).toBe('ready');
    const gamespaceId = deployment.gamespaceId as string;

    const attempts = await getMoodleTopomojoAttempts(throwaway.instanceId, [participant.userId]);
    expect(attempts.map(a => [a.eventId, a.state])).toEqual([[gamespaceId, 'inprogress']]);

    // Drop the bulk-deploy rows so the unfinished attempt is the only thing in Moodle
    // pointing at the gamespace - the case the bulk-deploy stop loop alone missed.
    const client = await connectMoodleDatabase();
    try {
      await client.query(`DELETE FROM mdl_topomojo_bulkdeploy_user WHERE jobid = $1`, [deployment.jobId]);
      await client.query(`DELETE FROM mdl_topomojo_bulkdeploy_job WHERE id = $1`, [deployment.jobId]);
    } finally {
      await client.end();
    }

    const before = await getGamespace(topoToken, gamespaceId);
    expect(before.isActive, 'TopoMojo reports the gamespace running before deletion').toBe(true);

    runMoodlePhp(`require_once($CFG->dirroot . '/course/lib.php'); course_delete_module(${throwawayCmid});`);
    throwawayCmid = undefined;

    const after = await getGamespace(topoToken, gamespaceId);
    expect(after.isActive, `gamespace ${gamespaceId} after deletion`).toBe(false);
    expect(after.endTime, 'completing a gamespace stamps its end time').toBeTruthy();
    expect(await getMoodleTopomojoAttempts(throwaway.instanceId)).toEqual([]);
  });
});
