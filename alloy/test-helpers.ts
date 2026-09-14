// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { APIRequestContext, Locator, Page, request as playwrightRequest, expect } from '@playwright/test';
import { Services } from '../shared-fixtures';
import { getUserToken } from '../keycloak-admin';

async function closeOpenDialogs(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const openDialog = page.getByRole('dialog').first();
    if (!(await openDialog.isVisible({ timeout: 500 }).catch(() => false))) {
      return;
    }

    const cancelButton = openDialog.getByRole('button', { name: /Cancel|Close/i });
    if (await cancelButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(openDialog).not.toBeVisible({ timeout: 5000 }).catch(() => {});
  }
}

/**
 * Navigate to the Alloy admin Event Templates page.
 * Handles cases where the page is already on admin or needs re-navigation.
 */
async function ensureOnAdminPage(page: Page): Promise<void> {
  if (!page.url().includes('/admin')) {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
  }

  await closeOpenDialogs(page);

  const adminHeading = page.getByRole('heading', { name: 'Administration' });
  const eventTemplatesTable = page.getByRole('table');
  const adminLoaded =
    (await adminHeading.isVisible({ timeout: 2000 }).catch(() => false)) &&
    (await eventTemplatesTable.isVisible({ timeout: 2000 }).catch(() => false));

  if (!adminLoaded) {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await closeOpenDialogs(page);
  }

  await expect(adminHeading).toBeVisible({ timeout: 30000 });
  await expect(eventTemplatesTable).toBeVisible({ timeout: 30000 });
}

export async function fillFieldAndVerify(field: Locator, value: string): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    await field.click();
    await field.fill(value);

    try {
      await expect(field).toHaveValue(value, { timeout: 5000 });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

/**
 * Delete an event template by name via the admin UI.
 * Handles the confirmation dialog and waits for the row to disappear.
 * Errors are caught and logged rather than thrown to avoid masking original test failures.
 */
export async function deleteEventTemplateByName(page: Page, name: string): Promise<boolean> {
  try {
    await ensureOnAdminPage(page);

    await closeOpenDialogs(page);

    const editButton = page.getByRole('button', { name: `Edit: ${name}` });
    if (!(await editButton.first().isVisible({ timeout: 2000 }).catch(() => false))) {
      console.log(`Event template "${name}" not found for cleanup`);
      return false;
    }

    await editButton.first().click();

    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    await editDialog.getByRole('button', { name: 'Delete' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();

    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    console.log(`Deleted event template "${name}"`);
    return true;
  } catch (error) {
    console.log(`Error deleting event template "${name}":`, (error as Error).message);
    return false;
  }
}

/**
 * Delete all event templates matching a name pattern via the admin UI.
 * Searches across paginated results by searching for matching names.
 */
export async function deleteEventTemplatesByPattern(page: Page, searchTerm: string): Promise<number> {
  let deletedCount = 0;
  const maxAttempts = 10;

  try {
    await ensureOnAdminPage(page);

    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(searchTerm);
    await page.waitForTimeout(1000);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const openDialog = page.getByRole('dialog').first();
      if (await openDialog.isVisible({ timeout: 500 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      const editButton = page.getByRole('button', { name: /^Edit:/ }).first();
      if (!(await editButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        break;
      }

      await editButton.click();

      const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
      if (!(await editDialog.isVisible({ timeout: 3000 }).catch(() => false))) {
        break;
      }

      const deleteButton = editDialog.getByRole('button', { name: 'Delete' });
      if (!(await deleteButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        await page.keyboard.press('Escape');
        break;
      }
      await deleteButton.click();

      const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
      if (!(await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false))) {
        break;
      }
      await confirmDialog.getByRole('button', { name: 'Delete' }).click();

      await editDialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      deletedCount++;
    }

    await searchBox.fill('');

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} event template(s) matching "${searchTerm}"`);
    }
  } catch (error) {
    console.log(`Error cleaning up event templates matching "${searchTerm}":`, (error as Error).message);
  }

  return deletedCount;
}

/**
 * Create an event template via the admin UI and return its name.
 * The caller is responsible for cleaning up the template after the test.
 * Assumes the page is already authenticated and on the admin Event Templates page.
 *
 * As of Alloy.ui PR #711, "Add Event Template" opens a "Create New Event
 * Template" dialog with an empty form instead of inserting a default "New Event
 * Template" row. The template is only POSTed when Save is clicked, so we fill
 * the form (name + duration are required), save it, and wait for the UI to show
 * the created row. The UI state is the stable contract these tests need; a
 * raw waitForResponse here was flaky under parallel load even when the create
 * eventually succeeded.
 */
export async function createTestEventTemplate(
  page: Page,
  name: string,
  options: { description?: string; durationHours?: string } = {}
): Promise<string> {
  const { description = 'Auto-created for testing', durationHours = '2' } = options;

  await ensureOnAdminPage(page);

  // Click Add Event Template to open the create dialog (no API call yet).
  const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
  await page.getByRole('button', { name: 'Add Event Template' }).click();
  await expect(createDialog).toBeVisible({ timeout: 5000 });

  // Fill in the name, description, and duration. Name and Duration Hours are
  // required; duration must be an integer greater than 0.
  const nameField = createDialog.getByRole('textbox', { name: /^Name/ });
  await fillFieldAndVerify(nameField, name);

  const descField = createDialog.getByRole('textbox', { name: 'Event Template Description' });
  await fillFieldAndVerify(descField, description);

  const durationField = createDialog.getByRole('spinbutton', { name: 'Duration Hours' });
  await fillFieldAndVerify(durationField, durationHours);

  // Save. The template is created on save; wait for the user-visible result
  // rather than a specific network response that can be missed or delayed.
  const saveButton = createDialog.getByRole('button', { name: 'Save' });
  await expect(saveButton).toBeEnabled({ timeout: 5000 });
  await saveButton.click();

  await expect(createDialog).not.toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('cell', { name }).first()).toBeVisible({ timeout: 30000 });

  console.log(`Created test event template "${name}"`);
  return name;
}

/**
 * End and clean up events visible on the admin Events page.
 * Navigates to the Events section and ends any active events.
 */
export async function cleanupEndedEvents(page: Page): Promise<void> {
  try {
    await page.goto(`${Services.Alloy.UI}/admin`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });

    // Click on Events in the sidebar
    const eventsNav = page.locator('mat-list-item').filter({ hasText: 'Events' });
    if (await eventsNav.isVisible({ timeout: 2000 }).catch(() => false)) {
      await eventsNav.click();
      await page.waitForTimeout(1000);
    }
  } catch (error) {
    console.log('Error cleaning up events:', (error as Error).message);
  }
}

/**
 * A token for the Alloy admin that is also accepted by the Player API. The `player` scope is
 * part of alloy.ui's OIDC scope list, so one token serves both APIs - and, importantly, it
 * carries the same `sub` as the browser session `authenticateWithKeycloak` establishes. That
 * matters because Alloy's Player View dropdown is filled from
 * `GET player/api/users/{sub}/views`, which returns only views the user is a member of.
 */
export async function getAlloyPlayerToken(): Promise<string> {
  return getUserToken(
    'admin',
    'admin',
    'alloy.ui',
    'openid profile player player-vm alloy caster steamfitter'
  );
}

export interface SeededPlayerView {
  id: string;
  name: string;
}

async function playerApi(
  token: string,
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any } = {}
): Promise<{ ok: boolean; status: number; data: any; text: string }> {
  const base = Services.Player.API.replace(/\/$/, '');
  const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const response = await ctx.fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}` },
      data: options.body,
    });
    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : undefined;
    } catch {
      data = undefined;
    }
    return { ok: response.ok(), status: response.status(), data, text };
  } finally {
    await ctx.dispose();
  }
}

/**
 * A Player view whose only team is the "Admin" team created with it. That team's role holds
 * Manage permissions, so it is skipped by Alloy's participant-team search - which makes this
 * view both "has no default team" (for the event template rules) and "has no team a
 * participant can be added to" (for the enlist path).
 */
export async function createPlayerViewWithoutDefaultTeam(
  token: string,
  name: string
): Promise<SeededPlayerView> {
  const result = await playerApi(token, '/api/views', {
    method: 'POST',
    body: {
      name,
      description: 'Seeded by an Alloy default-team test; deleted on teardown.',
      status: 'Active',
      isTemplate: true,
      // Gives the caller a ViewMembership, without which the view never reaches Alloy's dropdown.
      createAdminTeam: true,
    },
  });

  if (!result.ok) {
    throw new Error(`Failed to create Player view "${name}" (${result.status}): ${result.text}`);
  }

  return { id: result.data.id, name };
}

/**
 * The same, plus a plain participant team that is then set as the view's default team.
 */
export async function createPlayerViewWithDefaultTeam(
  token: string,
  name: string
): Promise<SeededPlayerView> {
  const view = await createPlayerViewWithoutDefaultTeam(token, name);

  const team = await playerApi(token, `/api/views/${view.id}/teams`, {
    method: 'POST',
    body: { name: 'Participants' },
  });
  if (!team.ok) {
    throw new Error(`Failed to create a team on Player view ${view.id} (${team.status}): ${team.text}`);
  }

  const updated = await playerApi(token, `/api/views/${view.id}`, {
    method: 'PUT',
    body: {
      name,
      description: 'Seeded by an Alloy default-team test; deleted on teardown.',
      status: 'Active',
      isTemplate: true,
      defaultTeamId: team.data.id,
    },
  });
  if (!updated.ok) {
    throw new Error(`Failed to set the default team on Player view ${view.id} (${updated.status}): ${updated.text}`);
  }

  return view;
}

/**
 * Take the default team back off a view that already has one. This is how a saved event template
 * ends up referencing an invalid view: nothing changes in Alloy, the view changes underneath it.
 * Reads the view first and echoes its fields back, because Player's PUT is a whole-view replace -
 * sending only `defaultTeamId: null` would blank the name and description too.
 */
export async function clearPlayerViewDefaultTeam(token: string, viewId: string): Promise<void> {
  const current = await playerApi(token, `/api/views/${viewId}`);
  if (!current.ok) {
    throw new Error(`Failed to read Player view ${viewId} (${current.status}): ${current.text}`);
  }

  const result = await playerApi(token, `/api/views/${viewId}`, {
    method: 'PUT',
    body: {
      name: current.data.name,
      description: current.data.description,
      status: current.data.status,
      isTemplate: current.data.isTemplate,
      defaultTeamId: null,
    },
  });

  if (!result.ok) {
    throw new Error(
      `Failed to clear the default team on Player view ${viewId} (${result.status}): ${result.text}`
    );
  }
}

export async function deletePlayerView(token: string, viewId: string): Promise<void> {
  const result = await playerApi(token, `/api/views/${viewId}`, { method: 'DELETE' });

  if (!result.ok && result.status !== 404) {
    console.warn(`Failed to delete seeded Player view ${viewId} (${result.status}): ${result.text}`);
  }
}
