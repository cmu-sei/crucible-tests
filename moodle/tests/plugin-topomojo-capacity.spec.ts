// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md
//
// mod_topomojo shows instructors an advisory estimate of how many more labs the
// hypervisor has room for, from TopoMojo's GET api/workspace/{id}/capacity. The
// number of students still to launch is computed in Moodle; the number that fit
// comes from TopoMojo. Students never see the estimate.

import { test, expect, Services } from '../fixtures';
import { resolveMoodleLabActivityCmid } from '../db-helpers';
import { runMoodlePhp } from '../cli-helpers';
import {
  DemoUserEnrolment,
  enrolMoodleDemoUser,
  resolveMoodleDemoUserId,
  unenrolMoodleDemoUser,
} from '../demo-user-helpers';

function pendingLaunches(cmid: number): number {
  const out = runMoodlePhp(
    `require_once($CFG->dirroot . '/mod/topomojo/locallib.php');` +
      `$cm = get_coursemodule_from_id('topomojo', ${cmid}, 0, false, MUST_EXIST);` +
      `$t = $DB->get_record('topomojo', ['id' => $cm->instance], '*', MUST_EXIST);` +
      `echo topomojo_count_pending_launches($t, context_module::instance($cm->id));`
  );
  return Number(out);
}

test.describe('mod_topomojo lab capacity estimate', () => {
  let cmid: number;
  let demoUserId: number;
  let enrolment: DemoUserEnrolment;

  test.beforeAll(async () => {
    cmid = await resolveMoodleLabActivityCmid('topomojo');
    demoUserId = resolveMoodleDemoUserId();
    enrolment = enrolMoodleDemoUser('topomojo', cmid, demoUserId);
  });

  test.afterAll(async () => {
    if (enrolment?.created) {
      unenrolMoodleDemoUser(enrolment, demoUserId);
    }
  });

  test('instructor sees how many launches fit and how many students are still to launch', async ({
    moodleAdminPage: page,
  }) => {
    // Read the count Moodle will use rather than assume one: another worker's
    // teardown can unenrol the demo user while this test runs.
    const pending = pendingLaunches(cmid);

    await page.goto(`${Services.Moodle}/mod/topomojo/view.php?id=${cmid}`, { waitUntil: 'domcontentloaded' });

    const notice = page.locator('.alert', { hasText: 'Lab capacity:' });
    await expect(notice).toHaveCount(1);

    const text = (await notice.innerText()).replace(/\s+/g, ' ');
    expect(text).toMatch(/Lab capacity: (enough for everyone|short|full|room for more)\./);
    expect(text).toContain(`Students yet to launch: ${pending}.`);
    expect(text).toMatch(/Launches that fit: about \d+\.|No more launches fit\./);
    expect(text).toMatch(/Limited by (hypervisor memory|the resource pool memory limit)\./);
    // Viewer local time with a short zone name, e.g. "6:45 PM EST".
    expect(text).toMatch(/Estimate as of \d{1,2}:\d{2} [AP]M [A-Z+\-0-9]+\./);
  });

  test('students do not see the estimate', async ({ moodleDemoUserPage: page }) => {
    await page.goto(`${Services.Moodle}/mod/topomojo/view.php?id=${cmid}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body#page-mod-topomojo-view')).toBeVisible();
    await expect(page.getByText('Lab capacity:')).toHaveCount(0);
  });
});
