// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * Deleting a user's data must end the Alloy event they are still running.
 *
 * mod_crucible's privacy provider removes the user's attempts and bulk-deploy
 * rows. Those rows are the only place Moodle records the event id, so a provider
 * that dropped them without ending the event would leave the lab - its view and
 * its VMs - running in Alloy with nothing in Moodle able to find it again.
 *
 * The lab is started for a disposable user through the real bulk-deploy task,
 * and the deletion goes through tool_dataprivacy's own request pipeline, so the
 * provider is reached the way a privacy officer reaches it. Alloy is then asked
 * directly, as an account other than the plugin's, what became of the event.
 *
 * Deleting the whole activity runs the same "end the event, then drop the rows"
 * path through crucible_delete_instance(). That is covered against a throwaway
 * activity, since deleting the demo one would take everyone's data with it.
 */

import { APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { randomUUID } from 'crypto';
import { test, expect, Services } from '../fixtures';
import {
  cleanupMoodleCrucibleParticipant,
  connectMoodleDatabase,
  MoodleCrucibleParticipant,
  resolveMoodleLabActivityCmid,
  seedMoodleCrucibleParticipant,
} from '../db-helpers';
import {
  deleteMoodleUserDataViaPrivacyRequest,
  queueMoodleCrucibleBulkDeploy,
  runMoodleAdhocTask,
  runMoodlePhp,
} from '../cli-helpers';
import { getUserToken } from '../../keycloak-admin';

// Each run starts real Alloy events against the one demo template, so a second
// browser project would only double the deploys. What is under test is the
// plugin's server-side delete path, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-deploy test; runs on one project only');

const BULKDEPLOY_TASK = '\\mod_crucible\\task\\bulkdeploy_run';

/** tool_dataprivacy api::DATAREQUEST_STATUS_DELETED, where a processed delete request ends. */
const DATAREQUEST_STATUS_DELETED = 10;

/** The scopes alloy.ui itself asks for, so the token can read and end events. */
const ALLOY_SCOPES = 'openid profile player player-vm alloy caster steamfitter';

// Alloy.Api.Data Enumerations.cs EventStatus.
const LIVE_STATUSES = ['Creating', 'Planning', 'Applying', 'Active', 'Paused'];
const TEARDOWN_STATUSES = ['Ending', 'Ended', 'Expired'];

type AlloyEvent = { id: string; status: string };

async function alloyContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

function alloyBase(): string {
  return Services.Alloy.API.replace(/\/$/, '');
}

async function getAlloyEvent(token: string, eventId: string): Promise<AlloyEvent | undefined> {
  const ctx = await alloyContext();
  try {
    const response = await ctx.fetch(`${alloyBase()}/api/events/${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.ok() ? ((await response.json()) as AlloyEvent) : undefined;
  } finally {
    await ctx.dispose();
  }
}

/** Ends an event the test started, if a failure left it running. */
async function endAlloyEventIfLive(token: string, eventId: string): Promise<void> {
  const event = await getAlloyEvent(token, eventId);
  if (!event || !LIVE_STATUSES.includes(event.status)) {
    return;
  }
  const ctx = await alloyContext();
  try {
    const response = await ctx.fetch(`${alloyBase()}/api/events/${eventId}/end`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) {
      console.warn(`Ending Alloy event ${eventId} returned ${response.status()}`);
    }
  } finally {
    await ctx.dispose();
  }
}

type CrucibleRows = {
  attempts: { eventid: string; state: string }[];
  deployments: { eventid: string | null; status: string; errormessage: string | null }[];
};

async function crucibleRowsFor(userId: number): Promise<CrucibleRows> {
  const client = await connectMoodleDatabase();
  try {
    const attempts = await client.query(
      `SELECT eventid, state FROM mdl_crucible_attempts WHERE userid = $1`,
      [userId]
    );
    const deployments = await client.query(
      `SELECT eventid, status, errormessage FROM mdl_crucible_bulkdeploy_user WHERE userid = $1`,
      [userId]
    );
    return { attempts: attempts.rows, deployments: deployments.rows };
  } finally {
    await client.end();
  }
}

/**
 * Seeds a disposable OAuth2 participant in an activity and bulk-deploys an Alloy
 * event to them, returning the event id once Moodle recorded it as running.
 */
async function deployLab(
  cmid: number,
  token: string,
  seeded: MoodleCrucibleParticipant[],
  eventIds: string[]
): Promise<{ participant: MoodleCrucibleParticipant; eventId: string }> {
  const participant = await seedMoodleCrucibleParticipant(cmid, randomUUID());
  seeded.push(participant);

  queueMoodleCrucibleBulkDeploy(cmid, [participant.userId]);
  // The launcher polls Alloy until the event is Active before the task returns.
  runMoodleAdhocTask(BULKDEPLOY_TASK);

  const rows = await crucibleRowsFor(participant.userId);
  expect(rows.deployments, 'one bulk-deploy row for the participant').toHaveLength(1);
  const [deployment] = rows.deployments;
  if (deployment.eventid) {
    eventIds.push(deployment.eventid);
  }
  expect(deployment.status, `deploy failed: ${deployment.errormessage}`).toBe('ready');
  expect(rows.attempts).toEqual([{ eventid: deployment.eventid, state: 'inprogress' }]);

  const eventId = deployment.eventid as string;
  const event = await getAlloyEvent(token, eventId);
  expect(event?.status, 'Alloy reports the lab running before deletion').toBe('Active');

  return { participant, eventId };
}

test.describe('mod_crucible privacy deletion ends running labs', () => {
  test.describe.configure({ mode: 'serial', timeout: 10 * 60_000 });

  let crucibleCmid: number;
  let alloyToken: string;
  let seeded: MoodleCrucibleParticipant[] = [];
  let eventIds: string[] = [];
  let throwawayCmid: number | undefined;

  test.beforeAll(async () => {
    crucibleCmid = await resolveMoodleLabActivityCmid('crucible');
    alloyToken = await getUserToken('admin', 'admin', 'alloy.ui', ALLOY_SCOPES);

    // Every deploy goes through the plugin's system OAuth client, so without one
    // the launcher fails each user with a message that does not say why.
    const connected = runMoodlePhp(
      `$i = \\core\\oauth2\\api::get_issuer((int) get_config('crucible', 'issuerid'));`
      + ` echo \\core\\oauth2\\api::get_system_account($i) ? 'yes' : 'no';`
    );
    if (connected !== 'yes') {
      throw new Error(
        "mod_crucible's OAuth issuer has no connected system account, so bulk deploy cannot " +
          'start an event. Connect one at Site administration > Server > OAuth 2 services.'
      );
    }
  });

  test.afterEach(async () => {
    for (const eventId of eventIds) {
      await endAlloyEventIfLive(alloyToken, eventId);
    }
    eventIds = [];
    for (const participant of seeded) {
      await cleanupMoodleCrucibleParticipant(participant);
    }
    seeded = [];
    if (throwawayCmid !== undefined) {
      runMoodlePhp(
        `require_once($CFG->dirroot . '/course/lib.php');`
        + ` if ($DB->record_exists('course_modules', ['id' => ${throwawayCmid}])) {`
        + ` course_delete_module(${throwawayCmid}); }`
      );
      throwawayCmid = undefined;
    }
  });

  test('deleting a user ends their Alloy event and removes their rows', async () => {
    const { participant, eventId } = await deployLab(crucibleCmid, alloyToken, seeded, eventIds);

    expect(await deleteMoodleUserDataViaPrivacyRequest(participant.userId)).toBe(DATAREQUEST_STATUS_DELETED);

    const event = await getAlloyEvent(alloyToken, eventId);
    expect(TEARDOWN_STATUSES, `Alloy event ${eventId} after deletion`).toContain(event?.status);
    expect(await crucibleRowsFor(participant.userId)).toEqual({ attempts: [], deployments: [] });
  });

  test('deleting an activity ends its Alloy events and removes its rows', async () => {
    // A copy of the demo activity, pointed at the same template, in the same course.
    throwawayCmid = Number(runMoodlePhp(
      `require_once($CFG->dirroot . '/course/lib.php'); \\core\\session\\manager::set_user(get_admin());`
      + ` $cm = get_coursemodule_from_id('crucible', ${crucibleCmid}, 0, false, MUST_EXIST);`
      + ` $demo = $DB->get_record('crucible', ['id' => $cm->instance], '*', MUST_EXIST);`
      + ` $m = (object) ['modulename' => 'crucible', 'course' => $cm->course, 'section' => 0,`
      + ` 'visible' => 0, 'name' => 'E2E privacy throwaway ' . time(),`
      // create_module() insists on the form's editor field rather than intro itself.
      + ` 'introeditor' => ['text' => '', 'format' => FORMAT_HTML, 'itemid' => 0],`
      + ` 'eventtemplateid' => $demo->eventtemplateid, 'vmapp' => $demo->vmapp,`
      + ` 'clock' => $demo->clock];`
      + ` echo create_module($m)->coursemodule;`
    ));
    expect(throwawayCmid).toBeGreaterThan(0);

    const { participant, eventId } = await deployLab(throwawayCmid, alloyToken, seeded, eventIds);

    runMoodlePhp(`require_once($CFG->dirroot . '/course/lib.php'); course_delete_module(${throwawayCmid});`);
    throwawayCmid = undefined;

    const event = await getAlloyEvent(alloyToken, eventId);
    expect(TEARDOWN_STATUSES, `Alloy event ${eventId} after deletion`).toContain(event?.status);
    expect(await crucibleRowsFor(participant.userId)).toEqual({ attempts: [], deployments: [] });
  });
});
