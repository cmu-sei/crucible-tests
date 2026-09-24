// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { APIRequestContext, request as pwRequest, test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import {
  createKeycloakUser,
  deleteKeycloakUser,
  getKeycloakAdminToken,
  getUserToken,
  tempUsername,
  KeycloakUser,
} from '../../../keycloak-admin';

/** The launch step the seeded failure always fails on. */
const EXPECTED_STAGE = 'CreatingView';

const alloyHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

interface AlloyEvent {
  id: string;
  status: string;
  internalStatus: string;
  failureCount: number;
  errorMessage: string | null;
  lastLaunchStatus: string | null;
  lastLaunchInternalStatus: string | null;
  viewId: string | null;
  workspaceId: string | null;
  scenarioId: string | null;
}

function alloyToken(username = 'admin', password = 'admin'): Promise<string> {
  return getUserToken(username, password, 'alloy.ui', 'openid alloy');
}

/**
 * A Player-scoped token. `alloy.ui` is used rather than `player.ui` because it is the only
 * client in the crucible realm that both carries the `player` scope and allows the direct
 * access grant this suite needs.
 */
function playerToken(): Promise<string> {
  return getUserToken('admin', 'admin', 'alloy.ui', 'openid player');
}

const VIEW_DESCRIPTION = 'Auto-created to verify failed-launch reporting.';

interface SeededPlayerView {
  viewId: string;
  teamId: string;
}

async function updatePlayerViewDefaultTeam(
  api: APIRequestContext,
  token: string,
  viewId: string,
  name: string,
  defaultTeamId: string | null
): Promise<void> {
  const response = await api.put(`${Services.Player.API}/api/views/${viewId}`, {
    headers: alloyHeaders(token),
    data: { name, description: VIEW_DESCRIPTION, status: 'Active', isTemplate: false, defaultTeamId },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

/**
 * Create a Player View with a participant Team set as its default. Alloy refuses to save an
 * Event Template whose View has no default Team, so the View has to start out valid.
 */
async function createPlayerViewWithDefaultTeam(
  api: APIRequestContext,
  token: string,
  name: string
): Promise<SeededPlayerView> {
  const viewResponse = await api.post(`${Services.Player.API}/api/views`, {
    headers: alloyHeaders(token),
    data: { name, description: VIEW_DESCRIPTION, status: 'Active' },
  });
  expect(viewResponse.status(), await viewResponse.text()).toBe(201);
  const viewId = (await viewResponse.json()).id as string;

  const teamResponse = await api.post(`${Services.Player.API}/api/views/${viewId}/teams`, {
    headers: alloyHeaders(token),
    data: { name: 'Participants' },
  });
  expect(teamResponse.status(), await teamResponse.text()).toBe(201);
  const teamId = (await teamResponse.json()).id as string;

  await updatePlayerViewDefaultTeam(api, token, viewId, name, teamId);

  return { viewId, teamId };
}

/**
 * Leave the View with no Team a participant can join, after the Event Template has been saved
 * against it - the way a View gets broken by someone editing it in Player later.
 */
async function removeParticipantTeam(
  api: APIRequestContext,
  token: string,
  view: SeededPlayerView,
  name: string
): Promise<void> {
  // The default-team foreign key blocks deleting the Team while the View still points at it.
  await updatePlayerViewDefaultTeam(api, token, view.viewId, name, null);

  const response = await api.delete(`${Services.Player.API}/api/teams/${view.teamId}`, {
    headers: alloyHeaders(token),
  });
  expect(response.ok(), await response.text()).toBe(true);
}

/**
 * Create a published Event Template. Published so that any authenticated user picks up
 * ViewEventTemplate on it and can launch it from the home page.
 */
async function createFailingEventTemplate(
  api: APIRequestContext,
  token: string,
  name: string,
  viewId: string
): Promise<string> {
  const response = await api.post(`${Services.Alloy.API}/api/eventTemplates`, {
    headers: alloyHeaders(token),
    data: {
      name,
      description: VIEW_DESCRIPTION,
      durationHours: 1,
      viewId,
      isPublished: true,
      useDynamicHost: false,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as string;
}

async function launchEvent(
  api: APIRequestContext,
  token: string,
  templateId: string
): Promise<AlloyEvent> {
  const response = await api.post(
    `${Services.Alloy.API}/api/eventTemplates/${templateId}/events`,
    { headers: alloyHeaders(token) }
  );
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

async function getEvent(api: APIRequestContext, token: string, eventId: string): Promise<AlloyEvent> {
  const response = await api.get(`${Services.Alloy.API}/api/events/${eventId}`, {
    headers: alloyHeaders(token),
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

/** Every Event launched from a template, regardless of who launched it or its status. */
async function getTemplateEvents(
  api: APIRequestContext,
  token: string,
  templateId: string
): Promise<AlloyEvent[]> {
  const response = await api.get(
    `${Services.Alloy.API}/api/eventTemplates/${templateId}/events`,
    { headers: alloyHeaders(token) }
  );
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

/**
 * Poll until the Event has finished failing. A permanent launch failure is routed through
 * teardown first, so the Event passes through Ending before it settles on Failed.
 */
async function waitForFailedEvent(
  api: APIRequestContext,
  token: string,
  eventId: string
): Promise<AlloyEvent> {
  await expect
    .poll(async () => (await getEvent(api, token, eventId)).status, {
      timeout: 120000,
      intervals: [2000],
      message: `Event ${eventId} never reached the Failed status`,
    })
    .toBe('Failed');

  return getEvent(api, token, eventId);
}

async function deleteEvent(api: APIRequestContext, token: string, eventId: string): Promise<void> {
  const response = await api.delete(`${Services.Alloy.API}/api/events/${eventId}`, {
    headers: alloyHeaders(token),
  });
  if (!response.ok()) {
    console.log(`Cleanup: deleting event ${eventId} returned ${response.status()}`);
  }
}

async function deleteEventTemplate(
  api: APIRequestContext,
  token: string,
  templateId: string
): Promise<void> {
  const response = await api.delete(`${Services.Alloy.API}/api/eventTemplates/${templateId}`, {
    headers: alloyHeaders(token),
  });
  if (!response.ok()) {
    console.log(`Cleanup: deleting event template ${templateId} returned ${response.status()}`);
  }
}

async function deletePlayerView(
  api: APIRequestContext,
  token: string,
  viewId: string
): Promise<void> {
  const response = await api.delete(`${Services.Player.API}/api/views/${viewId}`, {
    headers: alloyHeaders(token),
  });
  if (!response.ok()) {
    console.log(`Cleanup: deleting player view ${viewId} returned ${response.status()}`);
  }
}

test.describe('Events Management', () => {
  let api: APIRequestContext;
  let adminToken: string;
  let playerAdminToken: string;
  const seededTemplateIds: string[] = [];
  const seededViewIds: string[] = [];
  let seededUser: KeycloakUser | null = null;

  /** Seed a published Event Template that always fails on its first launch attempt. */
  async function seedFailingEventTemplate(name: string): Promise<string> {
    const viewName = `${name} View`;
    const view = await createPlayerViewWithDefaultTeam(api, playerAdminToken, viewName);
    seededViewIds.push(view.viewId);

    const templateId = await createFailingEventTemplate(api, adminToken, name, view.viewId);
    seededTemplateIds.push(templateId);

    await removeParticipantTeam(api, playerAdminToken, view, viewName);

    return templateId;
  }

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ ignoreHTTPSErrors: true });
    adminToken = await alloyToken();
    playerAdminToken = await playerToken();
  });

  test.afterEach(async () => {
    for (const templateId of seededTemplateIds.splice(0)) {
      // Events first: an Event Template cannot be deleted while its Events still exist.
      for (const event of await getTemplateEvents(api, adminToken, templateId)) {
        await deleteEvent(api, adminToken, event.id);
      }
      await deleteEventTemplate(api, adminToken, templateId);
    }
    for (const viewId of seededViewIds.splice(0)) {
      await deletePlayerView(api, playerAdminToken, viewId);
    }
    if (seededUser) {
      await deleteKeycloakUser(await getKeycloakAdminToken(), seededUser.id, seededUser.realm);
      seededUser = null;
    }
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test('Event Lifecycle - Failed State Handling', async ({ page }) => {
    // A failing launch is routed through teardown before it settles on Failed.
    test.setTimeout(300000);

    const templateName = `ZZ Failed Launch ${Date.now()}`;

    // 1. Create an event that cannot launch (its Player View has no team to join)
    const templateId = await seedFailingEventTemplate(templateName);

    const launched = await launchEvent(api, adminToken, templateId);

    // expect: the event starts out being created
    expect(launched.status).toBe('Creating');

    // 2. Monitor the event status as it attempts to launch
    // expect: status changes to Failed once an orchestration step fails
    const failed = await waitForFailedEvent(api, adminToken, launched.id);

    // expect: failure count is incremented
    expect(failed.failureCount).toBeGreaterThan(0);

    // expect: internal status records the failure
    expect(failed.internalStatus).toBe('FailedLaunch');

    // expect: an error message describing the failure is available, and it names the step that
    // failed rather than only reporting that something did
    expect(failed.errorMessage).toContain('Failed to create the virtual environment');

    // expect: the last launch status pinpoints the step that failed
    expect(failed.lastLaunchStatus).toBe('Creating');
    expect(failed.lastLaunchInternalStatus).toBe(EXPECTED_STAGE);

    // expect: nothing is left behind in Player, Caster or Steamfitter
    expect(failed.viewId).toBeNull();
    expect(failed.workspaceId).toBeNull();
    expect(failed.scenarioId).toBeNull();

    // expect: the full diagnostic text is not on the Event itself - it can run to kilobytes
    // of infrastructure output, so it is served separately to ManageEvents holders only
    expect(failed).not.toHaveProperty('errorDetail');

    const detailResponse = await api.get(
      `${Services.Alloy.API}/api/events/${launched.id}/error-detail`,
      { headers: alloyHeaders(adminToken) }
    );
    expect(detailResponse.status()).toBe(200);
    expect((await detailResponse.json()).errorDetail).toBeTruthy();

    // 3. Check the event in the admin Events section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    await page.locator('mat-list-item').filter({ hasText: 'Events' }).click();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: failed events can be filtered into view
    const failedCheckbox = page.getByRole('checkbox', { name: 'Failed' });
    await expect(failedCheckbox).toBeVisible();
    await failedCheckbox.check();
    await expect(failedCheckbox).toBeChecked();

    // expect: Status column is visible
    await expect(page.getByRole('columnheader', { name: 'Status', exact: true })).toBeVisible();

    // Expanding a row adds its own Search boxes, so anchor on the toolbar's.
    await page.getByRole('textbox', { name: 'Search' }).first().fill(templateName);

    const eventRow = page.getByRole('row').filter({ hasText: templateName }).first();
    await expect(eventRow).toBeVisible({ timeout: 15000 });

    // expect: the row is flagged as failed rather than only reading 'Failed'
    await expect(eventRow.locator('mat-icon.error-indicator')).toBeVisible();

    // 4. Expand the row
    await eventRow.getByRole('cell').filter({ hasText: templateName }).click();

    // expect: the panel explains what went wrong and where
    const failurePanel = page.locator('.error-container');
    await expect(failurePanel).toBeVisible();
    await expect(failurePanel.getByText('Failure', { exact: true })).toBeVisible();
    await expect(failurePanel.getByText(failed.errorMessage!)).toBeVisible();
    await expect(failurePanel.getByText(`Failed at: ${EXPECTED_STAGE}`)).toBeVisible();

    // expect: the full detail is fetched on demand and offered for copying
    await expect(failurePanel.locator('pre.error-detail')).toBeVisible({ timeout: 15000 });
    await expect(failurePanel.getByRole('button', { name: 'Copy Details' })).toBeVisible();

    // Restore the list
    await page.getByRole('textbox', { name: 'Search' }).first().fill('');
    await failedCheckbox.uncheck();
  });

  // An ordinary user has to be told their launch broke and be able to retry, without being
  // handed the diagnosis: the upstream response and infrastructure output can name internal
  // hostnames, addresses and variable values, so they stay behind the admin-only error-detail
  // endpoint and the admin Events panel.
  test('Failed Launch - User Is Told It Failed But Not The Infrastructure Output', async ({
    page,
  }) => {
    test.setTimeout(300000);

    const templateName = `ZZ Failed Launch User ${Date.now()}`;
    const templateId = await seedFailingEventTemplate(templateName);

    const username = tempUsername('alloy-failuser');
    const password = 'Cr4ucible!Test';
    seededUser = await createKeycloakUser(await getKeycloakAdminToken(), { username, password });

    // Every authenticated user picks up ViewEventTemplate on a published Event Template, so
    // this user needs no role or membership to launch it.
    await authenticateWithKeycloak(page, Services.Alloy.UI, username, password);

    // Record every Event payload the browser receives, to prove the detail never arrives.
    const eventPayloads: string[] = [];
    page.on('response', async (response) => {
      if (!response.url().includes('/api/events')) return;
      const body = await response.text().catch(() => '');
      if (body) eventPayloads.push(body);
    });

    await page.goto(`${Services.Alloy.UI}/templates/${templateId}`);
    await expect(page.getByRole('heading', { name: templateName })).toBeVisible({
      timeout: 30000,
    });

    // 1. Launch an event that cannot succeed
    await page.getByRole('button', { name: 'Launch', exact: true }).click();

    // expect: the user is told the launch failed, in an assertive live region
    const failureAlert = page.getByRole('alert').filter({ hasText: /failed to launch/i });
    await expect(failureAlert).toBeVisible({ timeout: 120000 });
    await expect(
      failureAlert.getByText('Please try again. Contact an administrator if it continues to fail.')
    ).toBeVisible();

    // expect: the message is deliberately generic - the summary and the step it failed at are
    // for administrators, not shown on the user's card
    await expect(page.getByText(/Failed to create the virtual environment/)).toHaveCount(0);
    await expect(page.getByText(new RegExp(EXPECTED_STAGE))).toHaveCount(0);

    // expect: the identifiers an administrator needs are one click away, and the user can
    // retry without an administrator
    await expect(failureAlert.getByRole('button', { name: 'Copy failure details' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Launch Again' })).toBeVisible();

    // expect: the infrastructure output never reached the browser
    expect(eventPayloads.length).toBeGreaterThan(0);
    for (const body of eventPayloads) {
      expect(body).not.toContain('errorDetail');
    }

    // 2. Ask for the detail directly
    const templateEvents = await getTemplateEvents(api, adminToken, templateId);
    expect(templateEvents).toHaveLength(1);

    const userToken = await alloyToken(username, password);
    const forbidden = await api.get(
      `${Services.Alloy.API}/api/events/${templateEvents[0].id}/error-detail`,
      { headers: alloyHeaders(userToken) }
    );

    // expect: refused - the endpoint requires the system-wide ManageEvents permission, which
    // the user who launched the event deliberately does not get from creating it
    expect(forbidden.status()).toBe(403);
  });
});
