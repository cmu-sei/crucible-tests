// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

// Launching is the only mod_crucible flow that makes Moodle *write* to Alloy:
// "Launch Lab" POSTs /eventtemplates/{id}/events and "End Lab" DELETEs
// /events/{id}/end, both through the OAuth client locallib.php hands back from
// crucible_configure_api_client(). That client is where certificate
// verification and the request timeouts are set, so only a real deploy proves
// the configured client can still reach Alloy.
//
// Loading view.php is not enough on its own: "Scheduled Duration" is a static
// label and view.php:300 reads durationHours off the event template
// unconditionally, so the Lab Details section renders - and the existing
// plugin-view-pages.spec.ts assertions still pass - even when the Alloy read
// failed and left $eventtemplate false.

import { APIRequestContext, Page, request as playwrightRequest } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { connectMoodleDatabase, resolveMoodleLabActivityCmid } from '../db-helpers';
import { getUserToken } from '../../keycloak-admin';

// This test deploys a real Alloy event against the one demo activity, the one
// event template, and the one admin account. A second browser project would not
// just double the deploy - it would race the first: the sibling's launch leaves
// the activity with no launch button to press, and its Keycloak login rotates the
// refresh token Moodle stored for the plugin's OAuth client, so the next Alloy
// read comes back 401. What is under test is the plugin's server-side write path,
// not browser rendering, so one project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-deploy test; runs on one project only');

// Alloy builds the event asynchronously - Creating, then Planning and Applying,
// then Active - and the browser polls it rather than the POST blocking.
const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

/** The scopes alloy.ui itself asks for, so the token can read and end events. */
const ALLOY_SCOPES = 'openid profile player player-vm alloy caster steamfitter';

// Statuses that still hold a view and VMs, so an event in one of them has to be
// ended before the next launch (Alloy.Api.Data Enumerations.cs EventStatus).
const LIVE_STATUSES = ['Creating', 'Planning', 'Applying', 'Active', 'Paused'];

// locallib.php get_active_events() counts Ending among a user's active events, so
// the launch button stays hidden until the teardown has finished - ending an event
// is not enough on its own, the run has to wait it out.
const TEARDOWN_STATUSES = ['Ending', 'Ended', 'Expired'];

type AlloyEvent = {
  id: string;
  eventTemplateId: string;
  status: string;
  viewId: string | null;
};

async function alloyContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ ignoreHTTPSErrors: true });
}

function alloyBase(): string {
  return Services.Alloy.API.replace(/\/$/, '');
}

async function alloyAdminToken(): Promise<string> {
  try {
    return await getUserToken('admin', 'admin', 'alloy.ui', ALLOY_SCOPES);
  } catch (cause) {
    throw new Error(
      `Could not get an Alloy token for admin from ${Services.Keycloak}. The scenario needs ` +
        `the admin account and an alloy.ui client granting '${ALLOY_SCOPES}'.`,
      { cause }
    );
  }
}

/**
 * Checks Alloy knows the template before the browser is driven at all.
 *
 * The activity stores a bare GUID that nothing validates, so a stack whose Alloy
 * was reseeded points the activity at a template that no longer exists. Left to
 * the UI that surfaces as view.php throwing 'start_event failed' part-way
 * through a launch, which reads like a broken plugin rather than missing seed
 * data.
 */
async function requireAlloyEventTemplate(token: string, eventTemplateId: string): Promise<void> {
  const ctx = await alloyContext();
  try {
    const response = await ctx.fetch(`${alloyBase()}/api/eventTemplates/${eventTemplateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok()) {
      // Alloy answers 403 rather than 404 for a template it does not hold, so the
      // status alone does not separate "not seeded" from "not readable by this
      // account". Both are environment problems, and both are named here.
      throw new Error(
        `Alloy at ${alloyBase()} would not return event template ${eventTemplateId} ` +
          `(HTTP ${response.status()}), which the demo Crucible activity is pointed at. ` +
          'Either the template is not seeded in Alloy, or the admin account cannot read ' +
          'it. Seed it, repoint the activity at an existing template, or set ' +
          'MOODLE_CRUCIBLE_EVENT_TEMPLATE_ID.'
      );
    }
  } finally {
    await ctx.dispose();
  }
}

/** Reads an event straight from Alloy, as an account other than the plugin's. */
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

/**
 * The events this account holds for one template - the same list view.php builds.
 *
 * Asking Alloy instead of reading the page matters because a launch whose page
 * never rendered still created the event, so the page is not a reliable record of
 * what is deployed.
 */
async function myAlloyEvents(token: string, eventTemplateId: string): Promise<AlloyEvent[]> {
  const ctx = await alloyContext();
  try {
    const response = await ctx.fetch(
      `${alloyBase()}/api/eventTemplates/${eventTemplateId}/events/mine?includeInvites=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.ok() ? ((await response.json()) as AlloyEvent[]) : [];
  } finally {
    await ctx.dispose();
  }
}

/** Ends every event this account still has deployed for the template. */
async function endLiveEvents(token: string, eventTemplateId: string): Promise<string[]> {
  const live = (await myAlloyEvents(token, eventTemplateId)).filter((event) =>
    LIVE_STATUSES.includes(event.status)
  );

  for (const event of live) {
    await endAlloyEvent(token, event.id);
  }

  return live.map((event) => event.id);
}

/** Ends an event directly, for the case where the End Lab button never got used. */
async function endAlloyEvent(token: string, eventId: string): Promise<void> {
  const ctx = await alloyContext();
  try {
    await ctx.fetch(`${alloyBase()}/api/events/${eventId}/end`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } finally {
    await ctx.dispose();
  }
}

/** The event template GUID the activity is pointed at. */
async function resolveEventTemplateId(cmid: number): Promise<string> {
  // For pointing a run at another template without editing the activity - and
  // for exercising the preflight below against a template Alloy does not have.
  const override = process.env.MOODLE_CRUCIBLE_EVENT_TEMPLATE_ID;
  if (override) {
    return override;
  }

  const client = await connectMoodleDatabase();
  try {
    const result = await client.query(
      `SELECT a.eventtemplateid
         FROM mdl_course_modules cm
         JOIN mdl_modules m ON m.id = cm.module AND m.name = 'crucible'
         JOIN mdl_crucible a ON a.id = cm.instance
        WHERE cm.id = $1`,
      [cmid]
    );

    const eventTemplateId = result.rows[0]?.eventtemplateid;
    if (!eventTemplateId) {
      throw new Error(`Crucible activity ${cmid} has no event template GUID set.`);
    }
    return eventTemplateId;
  } finally {
    await client.end();
  }
}

/**
 * Opens the activity, and proves view.php rendered it rather than erroring.
 *
 * Every Alloy read on this page raises moodle_exception with an empty string
 * identifier (locallib.php:255), which Moodle renders as a bare "error/" under the
 * activity's own name and body id - so checking the body id alone passes on the
 * error page and the missing buttons surface later as an unexplained "element(s)
 * not found". The page is checked for its own content here instead, while Moodle's
 * message is still on screen to quote.
 *
 * The plugin's Alloy token lives in the Moodle session and nothing renews it, so
 * one load can 401 where the load after it re-authenticates and works. That makes
 * a single error page worth retrying; a stack that genuinely cannot reach Alloy
 * still fails, on the third try.
 */
async function openActivity(page: Page, cmid: number): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    await page.goto(`${Services.Moodle}/mod/crucible/view.php?id=${cmid}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.locator('body')).toHaveAttribute('id', /page-mod-crucible-view/);

    if (await page.locator('.crucible-activity-section--actions').count()) {
      return;
    }

    if (attempt === 3) {
      throw new Error(
        `view.php rendered no Lab Actions section for activity ${cmid} on ${attempt} loads, so ` +
          `the activity does not load. Moodle said: "${await mainText(page)}". A bare "error/" ` +
          'is an Alloy read that answered non-200 - check that Alloy is up and that the ' +
          "plugin's OAuth issuer still authenticates, not the activity settings."
      );
    }
  }
}

/** Whatever Moodle put in the content region, for quoting in a failure message. */
async function mainText(page: Page): Promise<string> {
  const text = (await page.getByRole('main').innerText()).trim().replace(/\s+/g, ' ');
  return text.slice(0, 200);
}

/**
 * Presses one of the lab buttons and answers the confirmation.
 *
 * formconfirm.js binds the click handler from an AMD module, so it lands some
 * time after domcontentloaded. A click that arrives before it submits the form
 * with start_confirmed still empty, and view.php ignores the request - which
 * would look exactly like a failed deploy. Retrying until the modal answers is
 * what makes that race harmless.
 */
async function pressAndConfirm(page: Page, buttonId: string, prompt: RegExp): Promise<void> {
  const dialog = page.locator('[data-region="modal-container"]').filter({ hasText: prompt });

  await expect(async () => {
    await page.locator(`#${buttonId}`).click();
    await expect(dialog).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 60000 });

  // Answering the modal submits the form, and view.php does not answer until Alloy
  // has accepted the deploy or the teardown - comfortably past the 10s default
  // action timeout on a loaded stack.
  await dialog.getByRole('button', { name: 'Yes' }).click({ timeout: 60000 });
}

/** The event id view.php publishes for its own polling code. */
async function currentEventId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const config = (window as Window & { CrucibleConfig?: { event?: string | null } }).CrucibleConfig;
    return config?.event ?? null;
  });
}

/**
 * Opens the activity in its launchable state, ending leftover events if needed.
 *
 * A run interrupted between Launch Lab and End Lab leaves its event deployed, and
 * view.php then opens the activity already launched - End Lab where the launch
 * button should be. Clearing that here is the difference between one bad run and
 * every run after it.
 */
async function openLaunchable(
  page: Page,
  token: string,
  eventTemplateId: string,
  cmid: number
): Promise<void> {
  const leftover = await endLiveEvents(token, eventTemplateId);

  // The launch button comes back only once the teardown has finished, because the
  // plugin counts an Ending event among the user's active ones.
  await expect(async () => {
    await openActivity(page, cmid);
    await expect(
      page.locator('#launch_button'),
      leftover.length
        ? `events left deployed by an earlier run are still tearing down: ${leftover.join(', ')}`
        : 'the activity should open with no event running'
    ).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: leftover.length ? DEPLOY_TIMEOUT_MS : 60000 });
}

test.describe('mod_crucible lab deployment', () => {
  let cmid: number;
  let eventTemplateId: string;
  // Kept outside the test so the cleanup can still reach an event whose
  // assertions failed halfway through the deploy.
  let deployedEventId: string | null = null;

  // Set once the test has committed to a deploy, so the teardown only sweeps for
  // the project that actually ran it.
  let launched = false;

  // Minted once up front: doing it here means a stack without the Alloy client or
  // the admin account fails before anything has been deployed.
  let token: string;

  test.beforeAll(async () => {
    cmid = await resolveMoodleLabActivityCmid('crucible');
    eventTemplateId = await resolveEventTemplateId(cmid);
    token = await alloyAdminToken();
    await requireAlloyEventTemplate(token, eventTemplateId);
  });

  test.afterAll(async () => {
    // Guarded on the test having actually pressed Launch Lab: the other browser
    // project skips this test, and a sweep from there could end an event the
    // running project is in the middle of.
    if (!launched) {
      return;
    }

    // A deployed event holds Player views and VMs, and the plugin counts it among
    // the user's active events - so one left behind opens every later run's
    // activity already launched. Swept by template rather than by the id the page
    // published, which covers a launch whose page errored before publishing it.
    await endLiveEvents(token, eventTemplateId);
  });

  test('launching the lab deploys an Alloy event and ending it tears the event down', async ({
    moodleAdminPage: page,
  }) => {
    // Two Alloy deploys in series, each polled by the browser.
    test.setTimeout(DEPLOY_TIMEOUT_MS * 2 + 120000);

    await openLaunchable(page, token, eventTemplateId, cmid);

    const launchButton = page.locator('#launch_button');
    await expect(launchButton, 'the activity should open with no event running').toBeVisible();

    launched = true;
    await pressAndConfirm(page, 'launch_button', /launch the lab/i);

    // view.php has returned from start_event() by the time this renders, so the
    // POST to Alloy has already been made and accepted.
    await expect(async () => {
      deployedEventId = await currentEventId(page);
      expect(deployedEventId, 'view.php should publish the new event id').toBeTruthy();
    }).toPass({ timeout: 60000 });

    const created = await getAlloyEvent(token, deployedEventId!);
    expect(created, `Alloy should know event ${deployedEventId}`).toBeTruthy();
    expect(created!.eventTemplateId).toBe(eventTemplateId);

    // The workspace section only renders once view.php sees status Active, so
    // this waits out the whole deploy.
    const workspace = page.locator('#crucible-workspace-section');
    await expect(workspace, 'the deployed lab should render a Lab Workspace section').toBeVisible({
      timeout: DEPLOY_TIMEOUT_MS,
    });
    await expect(workspace.locator('.crucible-activity-section__header')).toHaveText('Lab Workspace');

    // Either the embedded frame or the Player link, depending on the activity's
    // vmapp setting; both are built from the view id Alloy returned.
    await expect(workspace.locator('iframe, a[href]').first()).toBeVisible();

    const active = await getAlloyEvent(token, deployedEventId!);
    expect(active!.status, 'Alloy should report the event Active').toBe('Active');
    expect(active!.viewId, 'an Active event should have a Player view').toBeTruthy();

    // A failed Alloy call does not stop the page, it leaves a warning on it.
    await expect(page.locator('body')).not.toContainText('Debug info:');

    await pressAndConfirm(page, 'end_button', /end the lab/i);

    // A stop closes the attempt and redirects to the review page (view.php:209),
    // so the lab form is gone rather than back in its launchable state. The
    // redirect follows the DELETE immediately, so this waits on that one call - and
    // reports what view.php put on screen instead, because the page it errors onto
    // never redirects and would otherwise just burn the timeout.
    await page
      .waitForURL(/\/mod\/crucible\/review\.php/, { timeout: 2 * 60 * 1000 })
      .catch(async (cause) => {
        throw new Error(
          `Ending the lab did not land on the review page. view.php is showing: ` +
            `"${await mainText(page)}".`,
          { cause }
        );
      });

    const ended = await getAlloyEvent(token, deployedEventId!);
    expect(TEARDOWN_STATUSES, 'Alloy should be tearing the event down').toContain(ended!.status);

    // And the activity is launchable again, which is the state the next run needs.
    // The teardown this test started is still in flight, and the plugin counts an
    // Ending event among the active ones, so the button can take until the event
    // has finished ending to come back.
    await expect(async () => {
      await openActivity(page, cmid);
      await expect(launchButton, 'the activity should offer the launch button again').toBeVisible({
        timeout: 5000,
      });
    }).toPass({ timeout: DEPLOY_TIMEOUT_MS });
  });
});
