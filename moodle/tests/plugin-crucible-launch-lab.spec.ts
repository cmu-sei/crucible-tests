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

// Alloy builds the event asynchronously - Creating, then Planning and Applying,
// then Active - and the browser polls it rather than the POST blocking.
const DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

/** The scopes alloy.ui itself asks for, so the token can read and end events. */
const ALLOY_SCOPES = 'openid profile player player-vm alloy caster steamfitter';

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
  return getUserToken('admin', 'admin', 'alloy.ui', ALLOY_SCOPES);
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

async function openActivity(page: Page, cmid: number): Promise<void> {
  await page.goto(`${Services.Moodle}/mod/crucible/view.php?id=${cmid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.locator('body')).toHaveAttribute('id', /page-mod-crucible-view/);
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

  await dialog.getByRole('button', { name: 'Yes' }).click();
}

/** The event id view.php publishes for its own polling code. */
async function currentEventId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const config = (window as Window & { CrucibleConfig?: { event?: string | null } }).CrucibleConfig;
    return config?.event ?? null;
  });
}

test.describe('mod_crucible lab deployment', () => {
  let cmid: number;
  let eventTemplateId: string;
  // Kept outside the test so the cleanup can still reach an event whose
  // assertions failed halfway through the deploy.
  let deployedEventId: string | null = null;

  test.beforeAll(async () => {
    cmid = await resolveMoodleLabActivityCmid('crucible');
    eventTemplateId = await resolveEventTemplateId(cmid);
  });

  test.afterAll(async () => {
    if (!deployedEventId) {
      return;
    }

    // A deployed event holds Player views and VMs and counts against the
    // template's limit, so leaving one behind would make every later run open
    // the activity already launched.
    const token = await alloyAdminToken();
    const event = await getAlloyEvent(token, deployedEventId);
    if (event && !['Ending', 'Ended', 'Expired'].includes(event.status)) {
      await endAlloyEvent(token, deployedEventId);
    }
  });

  test('launching the lab deploys an Alloy event and ending it tears the event down', async ({
    moodleAdminPage: page,
  }) => {
    // Two Alloy deploys in series, each polled by the browser.
    test.setTimeout(DEPLOY_TIMEOUT_MS * 2 + 120000);

    await openActivity(page, cmid);

    // An event left running by an interrupted run starts the page in the ended
    // state instead, with nothing to launch.
    const launchButton = page.locator('#launch_button');
    await expect(launchButton, 'the activity should open with no event running').toBeVisible();

    await pressAndConfirm(page, 'launch_button', /launch the lab/i);

    // view.php has returned from start_event() by the time this renders, so the
    // POST to Alloy has already been made and accepted.
    await expect(async () => {
      deployedEventId = await currentEventId(page);
      expect(deployedEventId, 'view.php should publish the new event id').toBeTruthy();
    }).toPass({ timeout: 60000 });

    const token = await alloyAdminToken();
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
    // so the lab form is gone rather than back in its launchable state.
    await expect(page, 'ending the lab should land on the review page').toHaveURL(
      /\/mod\/crucible\/review\.php/,
      { timeout: DEPLOY_TIMEOUT_MS }
    );

    const ended = await getAlloyEvent(token, deployedEventId!);
    expect(['Ending', 'Ended', 'Expired'], 'Alloy should be tearing the event down').toContain(
      ended!.status
    );

    // And the activity is launchable again, which is the state the next run needs.
    await openActivity(page, cmid);
    await expect(launchButton, 'the activity should offer the launch button again').toBeVisible();
  });
});
