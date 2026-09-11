// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * Live verification of the gamespace fields mod_topomojo's bulk-deploy path
 * reads. The plugin's own PHPUnit suite drives `launcher` through a fake
 * `curl_multi_client` that returns canned JSON, so nothing there proves the real
 * API sends these fields at all. Each assertion below pins one assumption the
 * plugin makes:
 *
 *  - `expirationTime` is present and parseable — `launcher::resolve_endtime()`
 *    prefers it over `time() + duration`, and `topomojo_attempts.endtime` is NOT
 *    NULL with no default.
 *  - `variant` is present and 0-based — the plugin stores `variant + 1`, and a
 *    wrong value grades an attempt against another variant's questions.
 *  - `launchpointUrl` is minted only by the POST. The GET always reports null,
 *    which is what the launcher currently reads.
 */

import { test, expect } from '../fixtures';
import {
  deleteGamespace,
  getGamespace,
  getTopoMojoAdminToken,
  registerGamespace,
  TopoMojoGamespace,
} from '../../topomojo-helpers';
import { getMoodleTopomojoActivity } from '../db-helpers';

const topomojoActivityId = process.env.MOODLE_TOPOMOJO_ACTIVITY_ID || '21';

// These tests drive a live TopoMojo: each run registers real gamespaces and holds
// real VMs. They also share one Moodle instance, so a second browser project would
// double the VM cost and — where a test borrows an existing account rather than
// seeding one — race the first project for the same records. One project is enough:
// what is under test is the plugin's server-side behaviour, not browser rendering.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');


// The activity's own maxMinutes, so the expiry window asserted below is the one
// the plugin would actually request.
const REQUESTED_MINUTES = 30;

test.describe('mod_topomojo gamespace API contract', () => {
  // One gamespace is registered for the whole file: it holds real VMs, and both
  // assertions below read the same lifecycle (register response, then poll).
  let token: string;
  let registered: TopoMojoGamespace;
  let registeredAt: number;

  test.beforeAll(async () => {
    token = await getTopoMojoAdminToken();
    const activity = await getMoodleTopomojoActivity(topomojoActivityId);
    expect(
      activity.workspaceId,
      `activity ${topomojoActivityId} should name a TopoMojo workspace`
    ).toBeTruthy();

    registeredAt = Date.now();
    registered = await registerGamespace(token, {
      workspaceId: activity.workspaceId,
      maxMinutes: REQUESTED_MINUTES,
      maxAttempts: 3,
      points: 100,
      // 0 is what the plugin sends for "random variant"; the response reports
      // which one was actually deployed.
      variant: 0,
      subjectId: 'e2e-contract',
    });
  });

  test.afterAll(async () => {
    // A live gamespace holds real VMs; release it whatever the outcome above was.
    if (registered?.id) {
      await deleteGamespace(token, registered.id);
    }
  });

  test('a registered gamespace reports an expiration the plugin can store as endtime', async () => {
    expect(registered.id).toMatch(/^[0-9a-f]{32}$/);

    // resolve_endtime() feeds this straight to PHP strtotime(). TopoMojo emits
    // 7-digit fractional seconds, which is unusual but does parse.
    expect(registered.expirationTime, 'register response should carry expirationTime').toBeTruthy();
    const expiry = Date.parse(registered.expirationTime!);
    expect(Number.isNaN(expiry), `expirationTime "${registered.expirationTime}" should be parseable`).toBe(false);

    // Within the window we asked for, allowing a minute of clock/processing slack
    // either side. A value in the past would make close_attempts reap the attempt
    // on its next run.
    const expectedExpiry = registeredAt + REQUESTED_MINUTES * 60_000;
    expect(expiry).toBeGreaterThan(registeredAt);
    expect(Math.abs(expiry - expectedExpiry)).toBeLessThan(60_000);

    // The plugin stores variant + 1 into a 1-based column, so a 0-based integer
    // is required here.
    expect(typeof registered.variant, 'gamespace should report the deployed variant').toBe('number');
    expect(registered.variant).toBeGreaterThanOrEqual(0);
  });

  test('the poll response keeps expirationTime but never carries launchpointUrl', async () => {
    const polled = await getGamespace(token, registered.id);

    // wait_phase() polls this endpoint and hands the decoded body to
    // create_attempt_for_user(), so every field that path reads must survive the
    // round trip.
    expect(polled.id).toBe(registered.id);
    expect(polled.expirationTime, 'poll response should still carry expirationTime').toBeTruthy();
    expect(Number.isNaN(Date.parse(polled.expirationTime!))).toBe(false);
    expect(polled.variant).toBe(registered.variant);

    // Pending upstream: launcher::create_attempt_for_user() reads
    // $gamespace->launchpointUrl off this poll body, but only the register POST
    // mints one, on the in-flight response object. It is never persisted, so the
    // GET always reports null and every bulk-deployed attempt stores an empty
    // launchpointurl.
    //
    // Note the fix is NOT to carry the URL through from the register response:
    // the ticket it embeds is cached with a 180s sliding expiration, so a URL
    // written by a cron task is dead minutes later whichever response it came
    // from. It has to be minted at click time by re-registering with the
    // student's subjectId, which returns their existing gamespace with a fresh
    // ticket. What this test pins is the contract that forces that — the POST is
    // the only source of the field, and the poll the launcher actually reads is
    // not. Asserted as-is so a mint-on-demand fix flips the second expectation.
    expect(registered.launchpointUrl, 'register response mints the launchpoint URL').toContain('?t=');
    expect(polled.launchpointUrl ?? null, 'poll response omits the launchpoint URL').toBeNull();
  });
});
