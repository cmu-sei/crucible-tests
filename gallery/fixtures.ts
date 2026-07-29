// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import fs from 'fs';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
} from '../shared-fixtures';
import { authStatePath } from '../auth-paths';

/**
 * Gallery-specific fixtures
 * Extends shared fixtures with Gallery authentication
 */

/**
 * Gallery-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateGalleryWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Gallery.UI, username, password);
}

/**
 * Navigate to an exhibit from the My Exhibits page.
 * NOTE: This function assumes exhibits exist in the user's "My Exhibits" view.
 * Exhibit names may be clickable cells or text elements (not necessarily links).
 * @param page - Playwright Page object
 * @param exhibitName - Optional specific exhibit name to navigate to. If not provided, clicks the first exhibit.
 */
export async function navigateToFirstExhibit(page: Page, exhibitName?: string): Promise<void> {
  // Ensure we're on the home page with the My Exhibits table
  await expect(page.getByRole('table')).toBeVisible();

  if (exhibitName) {
    // Navigate to a specific exhibit by name
    // Use .first() to handle cases where multiple exhibits have the same name (parallel workers)
    const targetRow = page.getByRole('row').filter({ hasText: exhibitName }).first();
    await targetRow.waitFor({ state: 'visible', timeout: 10000 });
    // Click the exhibit name cell (column 0 is typically the name column)
    await targetRow.getByRole('cell').first().click();
  } else {
    // Navigate to the first exhibit in the list
    // In the current UI, exhibit names in table cells may not be <a> links
    // but the cells themselves are clickable
    const firstRow = page.getByRole('row').filter({ has: page.getByRole('cell') }).nth(1);
    const firstCell = firstRow.getByRole('cell').first(); // Column 0 is the exhibit name
    await firstCell.click();
  }

  // Expect to be navigated to the exhibit view
  await expect(page).toHaveURL(/\?exhibit=/);
}

/**
 * Navigate straight to an exhibit's Wall or Archive view by id.
 *
 * Prefer this over `navigateToFirstExhibit` when the test already knows the
 * exhibit id (e.g. from `seededExhibit`). My Exhibits is paginated, so with
 * other tests seeding exhibits concurrently the target row can land on page 2+
 * and a row lookup times out. `home-app.component.ts` reads `exhibit` and
 * `section` straight off the query string, so this is the same code path the UI
 * itself uses when you click through.
 */
export async function gotoExhibitSection(
  page: Page,
  exhibitId: string,
  section: 'wall' | 'archive'
): Promise<void> {
  await page.goto(`${Services.Gallery.UI}/?exhibit=${exhibitId}&section=${section}`, {
    waitUntil: 'domcontentloaded',
  });
}

/**
 * All known group name prefixes used by gallery group tests.
 * This is the single source of truth so that any test can clean up ALL prefixes.
 */
export const GROUP_TEST_PREFIXES = ['Search Group', 'Membership Group', 'Test Group', 'Debug Group'];

// ========================================================================
// API-based group cleanup (reliable, no UI race conditions)
// ========================================================================

/**
 * Get a Keycloak access token for the Gallery API.
 */
async function getGalleryApiToken(apiContext: APIRequestContext): Promise<string> {
  const tokenResponse = await apiContext.post(
    `${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`,
    {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
      ignoreHTTPSErrors: true,
    }
  );

  if (!tokenResponse.ok()) {
    throw new Error(`Failed to get Gallery API token: ${tokenResponse.status()} ${await tokenResponse.text()}`);
  }

  const data = await tokenResponse.json();
  return data.access_token;
}

/**
 * Delete a group by ID via the Gallery API.
 */
async function deleteGroupViaApi(apiContext: APIRequestContext, token: string, groupId: string, groupName: string): Promise<void> {
  const response = await apiContext.delete(`${Services.Gallery.API}/api/groups/${groupId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok() || response.status() === 404) {
    console.log(`API cleanup: Deleted group "${groupName}" (${groupId})`);
  } else {
    console.warn(`API cleanup: Failed to delete group "${groupName}" (${groupId}): ${response.status()}`);
  }
}

/**
 * Delete all groups matching the given prefixes via the Gallery API.
 * This is completely reliable even with parallel test workers because
 * it operates via HTTP API calls, not the UI.
 *
 * @param prefixes - Array of name prefixes to match for deletion
 */
export async function apiCleanupGroups(prefixes: string[] = GROUP_TEST_PREFIXES): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    // List all groups
    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/groups`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list groups: ${listResponse.status()}`);
      return;
    }

    const groups: Array<{ id: string; name: string }> = await listResponse.json();

    // Find and delete groups matching any prefix
    for (const group of groups) {
      if (prefixes.some(prefix => group.name.startsWith(prefix))) {
        await deleteGroupViaApi(apiContext, token, group.id, group.name);
      }
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a single group by exact name via the Gallery API.
 *
 * @param exactName - The exact group name to delete
 */
export async function apiDeleteGroupByName(exactName: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    // List all groups
    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/groups`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list groups: ${listResponse.status()}`);
      return;
    }

    const groups: Array<{ id: string; name: string }> = await listResponse.json();
    const target = groups.find(g => g.name === exactName);

    if (target) {
      await deleteGroupViaApi(apiContext, token, target.id, target.name);
    } else {
      console.log(`API cleanup: Group "${exactName}" not found, nothing to delete.`);
    }
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// API-based exhibit cleanup
// ========================================================================

/**
 * Delete an exhibit by ID via the Gallery API.
 */
async function deleteExhibitViaApi(apiContext: APIRequestContext, token: string, exhibitId: string, exhibitName: string): Promise<void> {
  const response = await apiContext.delete(`${Services.Gallery.API}/api/exhibits/${exhibitId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.ok() || response.status() === 404) {
    console.log(`API cleanup: Deleted exhibit "${exhibitName}" (${exhibitId})`);
  } else {
    console.warn(`API cleanup: Failed to delete exhibit "${exhibitName}" (${exhibitId}): ${response.status()}`);
  }
}

/**
 * Delete a single exhibit by exact name via the Gallery API.
 *
 * @param exactName - The exact exhibit name to delete
 */
export async function apiDeleteExhibitByName(exactName: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/exhibits`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list exhibits: ${listResponse.status()}`);
      return;
    }

    const exhibits: Array<{ id: string; name: string }> = await listResponse.json();
    const target = exhibits.find(e => e.name === exactName);

    if (target) {
      await deleteExhibitViaApi(apiContext, token, target.id, target.name);
    } else {
      console.log(`API cleanup: Exhibit "${exactName}" not found, nothing to delete.`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete all exhibits matching the given prefixes via the Gallery API.
 *
 * @param prefixes - Array of name prefixes to match for deletion
 */
export async function apiCleanupExhibits(prefixes: string[]): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/exhibits`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list exhibits: ${listResponse.status()}`);
      return;
    }

    const exhibits: Array<{ id: string; name: string }> = await listResponse.json();

    for (const exhibit of exhibits) {
      if (prefixes.some(prefix => exhibit.name.startsWith(prefix))) {
        await deleteExhibitViaApi(apiContext, token, exhibit.id, exhibit.name);
      }
    }
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// API-based collection cleanup
// ========================================================================

/**
 * Delete a collection by ID via the Gallery API.
 * DELETE /api/collections/{id} responds 204 promptly (measured 20-30ms against the
 * running stack), so await it directly. An earlier version of this helper claimed the
 * endpoint "never returns a response" and worked around that with a 2s timeout plus a
 * 10x1s polling loop — that cost >=1s of sleep per deleted collection and the premise
 * was wrong. The post-delete GET is kept as a single confirmation (no sleep), since
 * cleanup silently failing is worse than cleanup being slightly slower.
 */
async function deleteCollectionViaApi(apiContext: APIRequestContext, token: string, collectionId: string, collectionName: string): Promise<void> {
  const deleteResponse = await apiContext.delete(`${Services.Gallery.API}/api/collections/${collectionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 404 means someone else already removed it — also a success for cleanup purposes.
  if (!deleteResponse.ok() && deleteResponse.status() !== 404) {
    console.warn(
      `API cleanup: DELETE collection "${collectionName}" (${collectionId}) returned ${deleteResponse.status()}`
    );
  }

  const checkResponse = await apiContext.get(`${Services.Gallery.API}/api/collections/${collectionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (checkResponse.status() === 404) {
    console.log(`API cleanup: Deleted collection "${collectionName}" (${collectionId})`);
  } else {
    console.warn(
      `API cleanup: Collection "${collectionName}" (${collectionId}) still present after DELETE ` +
        `(GET returned ${checkResponse.status()})`
    );
  }
}

/**
 * Delete a single collection by exact name via the Gallery API.
 *
 * @param exactName - The exact collection name to delete
 */
export async function apiDeleteCollectionByName(exactName: string): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/collections`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list collections: ${listResponse.status()}`);
      return;
    }

    const collections: Array<{ id: string; name: string }> = await listResponse.json();
    const target = collections.find(c => c.name === exactName);

    if (target) {
      await deleteCollectionViaApi(apiContext, token, target.id, target.name);
    } else {
      console.log(`API cleanup: Collection "${exactName}" not found, nothing to delete.`);
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete all collections matching the given prefixes via the Gallery API.
 *
 * @param prefixes - Array of name prefixes to match for deletion
 */
export async function apiCleanupCollections(prefixes: string[]): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/collections`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list collections: ${listResponse.status()}`);
      return;
    }

    const collections: Array<{ id: string; name: string }> = await listResponse.json();

    for (const collection of collections) {
      if (prefixes.some(prefix => collection.name.startsWith(prefix))) {
        await deleteCollectionViaApi(apiContext, token, collection.id, collection.name);
      }
    }
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// API-based system role cleanup
// ========================================================================

/**
 * Delete all system roles matching the given prefixes via the Gallery API.
 *
 * Role specs create custom roles through the permission matrix UI; this is the
 * teardown counterpart so an `afterEach` can guarantee removal even when the test
 * body throws partway through.
 *
 * @param prefixes - Array of name prefixes to match for deletion
 */
export async function apiCleanupSystemRoles(prefixes: string[]): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    const listResponse = await apiContext.get(`${Services.Gallery.API}/api/system-roles`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (!listResponse.ok()) {
      console.warn(`API cleanup: Failed to list roles: ${listResponse.status()}`);
      return;
    }

    const roles: Array<{ id: string; name: string }> = await listResponse.json();

    for (const role of roles) {
      if (prefixes.some(prefix => role.name.startsWith(prefix))) {
        const response = await apiContext.delete(`${Services.Gallery.API}/api/system-roles/${role.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok() || response.status() === 404) {
          console.log(`API cleanup: Deleted role "${role.name}" (${role.id})`);
        } else {
          console.warn(`API cleanup: Failed to delete role "${role.name}": ${response.status()}`);
        }
      }
    }
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// API-based seeding for single-purpose records
// ========================================================================

/**
 * Create a bare collection via the API and return its id and name.
 *
 * Use this when a spec needs a collection to *exist* as a precondition (e.g. an
 * exhibit's parent) rather than exercising the create-collection UI itself. Pair
 * with `apiDeleteCollectionById` in an `afterEach`.
 */
export async function apiCreateCollection(
  name: string,
  description: string = 'Auto-seeded collection for Playwright tests'
): Promise<{ id: string; name: string }> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    const response = await apiContext.post(`${Services.Gallery.API}/api/collections`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name, description },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create collection: ${response.status()} ${await response.text()}`);
    }
    const collection: { id: string; name: string } = await response.json();
    console.log(`Seeded collection: ${collection.name} (${collection.id})`);
    return collection;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Create a bare exhibit in the given collection via the API.
 *
 * Pair with `apiDeleteExhibitById` (or delete the parent collection) in teardown.
 */
export async function apiCreateExhibit(
  collectionId: string,
  name: string,
  options: { showAdvanceButton?: boolean } = {}
): Promise<{ id: string; name: string }> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    const response = await apiContext.post(`${Services.Gallery.API}/api/exhibits`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name,
        description: 'Auto-seeded exhibit for Playwright tests',
        collectionId,
        showAdvanceButton: options.showAdvanceButton ?? true,
      },
    });
    if (!response.ok()) {
      throw new Error(`Failed to create exhibit: ${response.status()} ${await response.text()}`);
    }
    const exhibit: { id: string; name: string } = await response.json();
    console.log(`Seeded exhibit: ${exhibit.name} (${exhibit.id})`);
    return exhibit;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Set an exhibit's current move/inject via the API.
 *
 * Advancing an exhibit mutates persistent state, and `seededExhibit` is
 * worker-scoped — so a test that clicks Advance changes what every later test in
 * that worker sees. Call this in `afterEach` to put the position back.
 */
export async function apiSetExhibitMoveAndInject(
  exhibitId: string,
  move: number,
  inject: number
): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    const response = await apiContext.put(
      `${Services.Gallery.API}/api/exhibits/${exhibitId}/move/${move}/inject/${inject}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok()) {
      console.warn(
        `Failed to reset exhibit ${exhibitId} to move ${move}/inject ${inject}: ${response.status()}`
      );
    }
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Advance an exhibit via the API, returning the resulting move/inject or null
 * when the exhibit is already at its last position (the API answers 400 there).
 */
export async function apiAdvanceExhibit(
  exhibitId: string
): Promise<{ currentMove: number; currentInject: number } | null> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    const response = await apiContext.put(`${Services.Gallery.API}/api/exhibits/${exhibitId}/advance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status() === 400) {
      return null;
    }
    if (!response.ok()) {
      throw new Error(`Failed to advance exhibit: ${response.status()} ${await response.text()}`);
    }
    return await response.json();
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a collection by id. Safe to call for an already-deleted collection.
 */
export async function apiDeleteCollectionById(collectionId: string, label: string = collectionId): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    await deleteCollectionViaApi(apiContext, token, collectionId, label);
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete an exhibit by id. Safe to call for an already-deleted exhibit.
 */
export async function apiDeleteExhibitById(exhibitId: string, label: string = exhibitId): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);
    await deleteExhibitViaApi(apiContext, token, exhibitId, label);
  } finally {
    await apiContext.dispose();
  }
}

// ========================================================================
// UI-based group cleanup helpers (used for stale cleanup at test start)
// ========================================================================

/**
 * Dismiss any error/notification dialogs that may be blocking the UI.
 * Gallery shows "Not Found" or other error dialogs via CDK overlays
 * when operations fail (e.g. trying to delete an already-deleted group).
 */
export async function dismissErrorDialogs(page: Page): Promise<void> {
  const closeButtons = page.locator('dialog button img[alt="󰅚"], dialog button:has(img)').or(
    page.getByRole('dialog').filter({ hasNotText: /Create|Delete|Confirm/ }).locator('button')
  );

  const count = await closeButtons.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    try {
      const btn = closeButtons.nth(i);
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000 });
        console.log(`Dismissed error/notification dialog`);
      }
    } catch {
      // Ignore - dialog may have closed on its own
    }
  }
}

/**
 * Delete all groups from the Gallery admin Groups list whose name starts with the given prefix.
 * Uses the UI - best for pre-test cleanup on a single worker's page.
 */
export async function cleanupStaleGroups(page: Page, prefix: string): Promise<void> {
  await dismissErrorDialogs(page);

  const searchField = page.getByRole('textbox', { name: 'Search Groups' });
  await searchField.clear();
  const clearButton = page.getByRole('button', { name: 'Clear Search' });
  if (await clearButton.isEnabled().catch(() => false)) {
    await clearButton.click();
  }

  const maxIterations = 20;
  for (let i = 0; i < maxIterations; i++) {
    await dismissErrorDialogs(page);

    const matchingCells = page.getByRole('cell').filter({ hasText: new RegExp(`^${prefix}`) });
    const count = await matchingCells.count();
    if (count === 0) {
      break;
    }

    const groupName = await matchingCells.first().textContent();
    if (!groupName) break;
    const trimmedName = groupName.trim();
    console.log(`Stale cleanup: Found ${count} leftover group(s) matching "${prefix}", deleting "${trimmedName}"...`);

    try {
      const row = page.getByRole('row').filter({ hasText: trimmedName });
      await row.first().waitFor({ state: 'visible', timeout: 5000 });
      await row.first().locator('button').first().click();

      const confirmDialog = page.getByRole('dialog').filter({ hasText: /delete/i });
      await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });
      await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();

      await expect(page.getByRole('cell', { name: trimmedName })).not.toBeVisible({ timeout: 10000 });
      console.log(`Stale cleanup: Group "${trimmedName}" deleted successfully`);
    } catch (error) {
      console.log(`Stale cleanup: Failed to delete "${trimmedName}" via UI, trying API fallback...`);
      await dismissErrorDialogs(page);
      // Use API as fallback
      try {
        await apiDeleteGroupByName(trimmedName);
      } catch (apiError) {
        console.warn(`Stale cleanup: API fallback also failed for "${trimmedName}":`, apiError);
      }
    }
  }
}

/**
 * Ensure the page is on the Gallery admin Groups page.
 */
export async function ensureOnGroupsPage(page: Page): Promise<void> {
  await dismissErrorDialogs(page);
  await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();
  await page.getByRole('columnheader', { name: 'Group Name' }).waitFor({ state: 'visible', timeout: 10000 });
}

/**
 * Gallery-specific fixtures
 */
export type GalleryFixtures = {
  galleryAuthenticatedPage: Page;
};

/**
 * Worker-scoped fixtures for seeded test data.
 * Seeded data is created once per worker and shared across all tests in that worker.
 */
export type GalleryWorkerFixtures = {
  seededExhibit: SeededExhibitData;
};

/**
 * Path to the Gallery storageState saved by global-setup.ts. May not exist if the
 * global setup failed to provision (stack down at startup) — handled below.
 */
const galleryStatePath = authStatePath('gallery');

/**
 * True when global-setup successfully wrote the Gallery auth state this run.
 * Evaluated once at module load. Specs that want a clean unauthenticated context
 * still override this with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
const galleryStateExists = fs.existsSync(galleryStatePath);

/**
 * The topbar user-menu button renders only once the OIDC client has resolved a
 * user, so it is the "authenticated shell is up" marker for Gallery. The
 * enclosing mat-toolbar renders before authentication resolves and is therefore
 * not a safe signal.
 */
const GALLERY_APP_SHELL = 'app-topbar .options-text button';

/**
 * Navigate to Gallery and ensure the authenticated shell is up, falling back to a
 * full Keycloak login when the saved storageState is missing or expired.
 *
 * Prefer the `galleryAuthenticatedPage` fixture in specs; this is exported for the
 * few specs that need to control navigation themselves.
 */
export async function ensureGalleryAuthenticated(page: Page): Promise<void> {
  await page.goto(Services.Gallery.UI, { waitUntil: 'domcontentloaded' });

  const appShell = page.locator(GALLERY_APP_SHELL).first();
  const keycloakField = page.locator('input[name="username"]');

  // Race the authenticated shell against a Keycloak login form. The form appears
  // only if the saved state is missing/expired — in that case fall back to the
  // full interactive login so the test still proceeds (just not as fast).
  // waitForFirstVisible is cancellation-safe: a plain Promise.race leaves the
  // losing waitFor() running to its full timeout in the background.
  const winner = await waitForFirstVisible(
    page,
    [
      { key: 'shell', locator: appShell },
      { key: 'keycloak', locator: keycloakField },
    ],
    { timeout: 20000 }
  );

  if (winner !== 'shell') {
    // Either Keycloak appeared or neither did within the window — do a full login.
    await authenticateGalleryWithKeycloak(page);
    await appShell.waitFor({ state: 'visible', timeout: 30000 });
  }
}

/**
 * Open the Gallery admin section from the authenticated home page and wait for the
 * admin shell to render.
 *
 * The Administration entry lives in the topbar user menu and is permission-gated,
 * so it only exists once `permissionDataService.load()` has resolved.
 */
export async function gotoGalleryAdmin(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Administration' }).click();
  await expect(page).toHaveTitle('Gallery Admin');
}

/**
 * Click an admin sidebar section (Collections, Exhibits, Users, Roles, Groups).
 */
export async function gotoAdminSection(page: Page, section: string): Promise<void> {
  await page.locator('mat-list-item').filter({ hasText: section }).getByRole('button').click();
}

/**
 * Extended test with Gallery-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts, so every spec's browser context starts with a valid OIDC token
 * in localStorage. The `galleryAuthenticatedPage` fixture then just navigates and
 * waits for the Angular shell — no per-test Keycloak round-trip. Auth-flow specs
 * opt out with `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<GalleryFixtures, GalleryWorkerFixtures>({
  // Default the context to the saved auth state when it exists. When it doesn't
  // (provisioning failed), leave Playwright's default and rely on the fixture's
  // interactive-login fallback below.
  storageState: galleryStateExists ? galleryStatePath : undefined,

  galleryAuthenticatedPage: async ({ page }, use) => {
    await ensureGalleryAuthenticated(page);
    await use(page);
  },

  seededExhibit: [async ({}, use) => {
    // Worker-scoped: seed once per worker
    const seededData = await seedExhibitForAdmin('Test Collection', 'Test Exhibit', 'Test Team');
    await use(seededData);
    // Clean up after all tests in this worker are done
    await cleanupSeededExhibit(seededData);
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey };

// ========================================================================
// API-based data seeding for tests
// ========================================================================

/**
 * Seeded data structure returned by seedExhibitForAdmin.
 * Keep track of all IDs so cleanup can be performed in teardown.
 */
export interface SeededExhibitData {
  collectionId: string;
  collectionName: string;
  exhibitId: string;
  exhibitName: string;
  teamId: string;
  teamName: string;
  teamUserId: string;
  userId: string;
  cardIds: string[];
  teamCardIds: string[];
  articleIds: string[];
  teamArticleIds: string[];
}

/**
 * Seed a complete exhibit structure for the admin user:
 * - Create a Collection
 * - Create an Exhibit in that Collection
 * - Create a Team on that Exhibit
 * - Add the admin user to that Team
 *
 * This ensures the exhibit will appear in the admin's "My Exhibits" list.
 *
 * @param collectionNamePrefix - Prefix for the collection name (default: 'Test Collection')
 * @param exhibitNamePrefix - Prefix for the exhibit name (default: 'Test Exhibit')
 * @param teamNamePrefix - Prefix for the team name (default: 'Test Team')
 * @returns SeededExhibitData containing all created IDs
 */
export async function seedExhibitForAdmin(
  collectionNamePrefix: string = 'Test Collection',
  exhibitNamePrefix: string = 'Test Exhibit',
  teamNamePrefix: string = 'Test Team'
): Promise<SeededExhibitData> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    // Step 1: Get the admin user's ID
    const usersResponse = await apiContext.get(`${Services.Gallery.API}/api/users`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!usersResponse.ok()) {
      throw new Error(`Failed to get users: ${usersResponse.status()} ${await usersResponse.text()}`);
    }
    const users: Array<{ id: string; name: string }> = await usersResponse.json();
    const adminUser = users.find(u => u.name?.toLowerCase().includes('admin'));
    if (!adminUser) {
      throw new Error('Admin user not found in the Gallery database');
    }
    const userId = adminUser.id;

    // Step 2: Create a Collection
    // Include a random suffix in addition to the timestamp: parallel workers can
    // call Date.now() within the same millisecond and would otherwise produce
    // identically-named exhibits, causing strict-mode "resolved to N elements"
    // failures when a test filters rows by exhibit name.
    const timestamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collectionName = `${collectionNamePrefix} ${timestamp}`;
    const collectionResponse = await apiContext.post(`${Services.Gallery.API}/api/collections`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: collectionName,
        description: 'Auto-seeded collection for Playwright tests',
      },
    });
    if (!collectionResponse.ok()) {
      throw new Error(`Failed to create collection: ${collectionResponse.status()} ${await collectionResponse.text()}`);
    }
    const collection: { id: string; name: string } = await collectionResponse.json();
    console.log(`Seeded collection: ${collection.name} (${collection.id})`);

    // Step 3: Create an Exhibit in that Collection
    const exhibitName = `${exhibitNamePrefix} ${timestamp}`;
    const exhibitResponse = await apiContext.post(`${Services.Gallery.API}/api/exhibits`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: exhibitName,
        description: 'Auto-seeded exhibit for Playwright tests',
        collectionId: collection.id,
        showAdvanceButton: true,
      },
    });
    if (!exhibitResponse.ok()) {
      throw new Error(`Failed to create exhibit: ${exhibitResponse.status()} ${await exhibitResponse.text()}`);
    }
    const exhibit: { id: string; name: string } = await exhibitResponse.json();
    console.log(`Seeded exhibit: ${exhibit.name} (${exhibit.id})`);

    // Step 4: Create a Team on that Exhibit
    const teamName = `${teamNamePrefix} ${timestamp}`;
    // shortName is deliberately set, even though the API accepts a team without one.
    // `AdminTeamsComponent.sortTeams()` does an unguarded `a.shortName.toLowerCase()`
    // (see gallery/gallery-app-bugs.md §5), so a null-shortName team in the shared team
    // store makes the Exhibit Teams list throw and render no rows as soon as a second
    // team exists. Seeding a shortName keeps that app bug from turning every teams spec
    // into a cross-worker flake. Remove this note if/when §5 is fixed; keep the value.
    const teamResponse = await apiContext.post(`${Services.Gallery.API}/api/teams`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: teamName,
        shortName: `T${Date.now() % 100000}`,
        exhibitId: exhibit.id,
      },
    });
    if (!teamResponse.ok()) {
      throw new Error(`Failed to create team: ${teamResponse.status()} ${await teamResponse.text()}`);
    }
    const team: { id: string; name: string } = await teamResponse.json();
    console.log(`Seeded team: ${team.name} (${team.id})`);

    // Step 5: Add the admin user to that Team
    const teamUserResponse = await apiContext.post(`${Services.Gallery.API}/api/teamusers`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        teamId: team.id,
        userId: userId,
        isObserver: false,
      },
    });
    if (!teamUserResponse.ok()) {
      throw new Error(`Failed to add user to team: ${teamUserResponse.status()} ${await teamUserResponse.text()}`);
    }
    const teamUser: { id: string } = await teamUserResponse.json();
    console.log(`Added admin user to team (TeamUser ID: ${teamUser.id})`);

    // Step 6: Create Cards with Articles for the exhibit
    const cardIds: string[] = [];
    const teamCardIds: string[] = [];
    const articleIds: string[] = [];
    const teamArticleIds: string[] = [];

    // Create 3 cards at different moves/injects with 2 articles each.
    //
    // sourceType MUST be one of these values. Gallery.Api.Data Enumerations.cs declares
    // `SourceType { News = 10, Social = 20, Email = 30, Phone = 40, Intel = 50,
    // Reporting = 60, Orders = 70 }` — the values are spaced by 10, NOT 0-based. Sending
    // an unnamed number (0..6, as this fixture used to) is accepted by the API and stored,
    // but then `JsonStringEnumConverter` cannot map it back to a name and serialises the
    // raw number instead of a string. The Angular client types `sourceType` as a string
    // union and calls `.toLowerCase()` on it, so seeding invalid values made the Archive
    // search box throw `sourceType.toLowerCase is not a function` — a fixture defect that
    // looked like an app bug. Always use SOURCE_TYPE.
    const SOURCE_TYPE = {
      News: 10,
      Social: 20,
      Email: 30,
      Phone: 40,
      Intel: 50,
      Reporting: 60,
      Orders: 70,
    } as const;

    const cardData = [
      { move: 0, inject: 0, name: 'Test Card 1', articles: [
        { name: 'Intel Article 1', sourceType: SOURCE_TYPE.Intel, summary: 'E2E test intel article' },
        { name: 'News Article 1', sourceType: SOURCE_TYPE.News, summary: 'E2E test news article' }
      ]},
      { move: 1, inject: 0, name: 'Test Card 2', articles: [
        { name: 'Reporting Article 1', sourceType: SOURCE_TYPE.Reporting, summary: 'E2E test reporting article' },
        { name: 'Social Article 1', sourceType: SOURCE_TYPE.Social, summary: 'E2E test social article' }
      ]},
      { move: 1, inject: 1, name: 'Test Card 3', articles: [
        { name: 'Orders Article 1', sourceType: SOURCE_TYPE.Orders, summary: 'E2E test orders article' },
        { name: 'Email Article 1', sourceType: SOURCE_TYPE.Email, summary: 'E2E test email article' }
      ]}
    ];

    for (const cardDef of cardData) {
      // Create Card
      const cardResponse = await apiContext.post(`${Services.Gallery.API}/api/cards`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          name: cardDef.name,
          description: `Auto-seeded card for Playwright tests`,
          move: cardDef.move,
          inject: cardDef.inject,
          collectionId: collection.id,
        },
      });
      if (!cardResponse.ok()) {
        throw new Error(`Failed to create card: ${cardResponse.status()} ${await cardResponse.text()}`);
      }
      const card: { id: string; name: string } = await cardResponse.json();
      cardIds.push(card.id);
      console.log(`Seeded card: ${card.name} (${card.id})`);

      // Create a TeamCard linking the card to the team with isShownOnWall=true.
      // The Wall view (wall.component.ts) only renders cards that have a
      // TeamCard with isShownOnWall=true; without this the wall is empty even
      // though the Archive view shows the same cards.
      const teamCardResponse = await apiContext.post(`${Services.Gallery.API}/api/teamcards`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          teamId: team.id,
          cardId: card.id,
          move: cardDef.move,
          inject: cardDef.inject,
          isShownOnWall: true,
          canPostArticles: true,
        },
      });
      if (!teamCardResponse.ok()) {
        throw new Error(`Failed to create team card: ${teamCardResponse.status()} ${await teamCardResponse.text()}`);
      }
      const teamCard: { id: string } = await teamCardResponse.json();
      teamCardIds.push(teamCard.id);
      console.log(`Seeded team card (TeamCard ID: ${teamCard.id}, isShownOnWall=true)`);

      // Create Articles for this card
      for (const articleDef of cardDef.articles) {
        const articleResponse = await apiContext.post(`${Services.Gallery.API}/api/articles`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          data: {
            name: articleDef.name,
            summary: articleDef.summary,
            description: `<p>This is a test article created by Playwright for E2E testing. ${articleDef.summary}</p>`,
            collectionId: collection.id,
            exhibitId: exhibit.id,
            cardId: card.id,
            move: cardDef.move,
            inject: cardDef.inject,
            status: 0, // Active
            sourceType: articleDef.sourceType,
            sourceName: 'E2E Test Source',
            datePosted: new Date().toISOString(),
            openInNewTab: false,
          },
        });
        if (!articleResponse.ok()) {
          throw new Error(`Failed to create article: ${articleResponse.status()} ${await articleResponse.text()}`);
        }
        const article: { id: string; name: string } = await articleResponse.json();
        articleIds.push(article.id);
        console.log(`Seeded article: ${article.name} (${article.id})`);

        // Note: the Article→Team link (TeamArticleEntity) is created by the API itself.
        // ArticleService.CreateAsync (gallery.api .../Services/ArticleService.cs:126-156) fans out
        // one TeamArticle per TeamCard matching the article's cardId + exhibitId whenever the
        // article is posted with an exhibitId — which is exactly what we do above, after seeding
        // the TeamCard. POSTing to /api/teamarticles here would therefore always be a duplicate
        // insert (500 "A record with this identifier already exists."). We read the auto-created
        // links back after the loop instead.
      }
    }

    // Collect the TeamArticles the API auto-created for the articles above, so cleanup can
    // delete them explicitly rather than relying solely on the exhibit-delete cascade.
    const teamArticlesResponse = await apiContext.get(
      `${Services.Gallery.API}/api/exhibits/${exhibit.id}/teamarticles`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!teamArticlesResponse.ok()) {
      throw new Error(
        `Failed to read seeded team articles: ${teamArticlesResponse.status()} ${await teamArticlesResponse.text()}`,
      );
    }
    const teamArticles: { id: string; articleId: string }[] = await teamArticlesResponse.json();
    for (const teamArticle of teamArticles) {
      if (articleIds.includes(teamArticle.articleId)) {
        teamArticleIds.push(teamArticle.id);
      }
    }
    if (teamArticleIds.length !== articleIds.length) {
      throw new Error(
        `Expected one TeamArticle per seeded article (${articleIds.length}), got ${teamArticleIds.length}. ` +
          `The API auto-creates these in ArticleService.CreateAsync; a mismatch means the TeamCard/Article ` +
          `wiring in this seeder is wrong.`,
      );
    }
    console.log(`Seeded ${teamArticleIds.length} team articles (auto-created by the API)`);

    return {
      collectionId: collection.id,
      collectionName: collection.name,
      exhibitId: exhibit.id,
      exhibitName: exhibit.name,
      teamId: team.id,
      teamName: team.name,
      teamUserId: teamUser.id,
      userId: userId,
      cardIds,
      teamCardIds,
      articleIds,
      teamArticleIds,
    };
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Clean up seeded exhibit data created by seedExhibitForAdmin.
 * Note: Deleting the collection will cascade delete exhibits and teams,
 * but we'll be explicit for clarity.
 *
 * @param seededData - The SeededExhibitData returned by seedExhibitForAdmin
 */
export async function cleanupSeededExhibit(seededData: SeededExhibitData): Promise<void> {
  const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const token = await getGalleryApiToken(apiContext);

    // Delete TeamArticles
    for (const teamArticleId of seededData.teamArticleIds) {
      const response = await apiContext.delete(
        `${Services.Gallery.API}/api/teamarticles/${teamArticleId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok() || response.status() === 404) {
        console.log(`Cleanup: Deleted TeamArticle ${teamArticleId}`);
      }
    }

    // Delete Articles
    for (const articleId of seededData.articleIds) {
      const response = await apiContext.delete(
        `${Services.Gallery.API}/api/articles/${articleId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok() || response.status() === 404) {
        console.log(`Cleanup: Deleted Article ${articleId}`);
      }
    }

    // Delete Cards
    for (const cardId of seededData.cardIds) {
      const response = await apiContext.delete(
        `${Services.Gallery.API}/api/cards/${cardId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.ok() || response.status() === 404) {
        console.log(`Cleanup: Deleted Card ${cardId}`);
      }
    }

    // Delete TeamUser
    const teamUserDeleteResponse = await apiContext.delete(
      `${Services.Gallery.API}/api/teamusers/${seededData.teamUserId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (teamUserDeleteResponse.ok() || teamUserDeleteResponse.status() === 404) {
      console.log(`Cleanup: Deleted TeamUser ${seededData.teamUserId}`);
    }

    // Delete Team
    const teamDeleteResponse = await apiContext.delete(
      `${Services.Gallery.API}/api/teams/${seededData.teamId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (teamDeleteResponse.ok() || teamDeleteResponse.status() === 404) {
      console.log(`Cleanup: Deleted Team ${seededData.teamName} (${seededData.teamId})`);
    }

    // Delete Exhibit
    await deleteExhibitViaApi(apiContext, token, seededData.exhibitId, seededData.exhibitName);

    // Delete Collection (will also cascade delete if API supports it)
    await deleteCollectionViaApi(apiContext, token, seededData.collectionId, seededData.collectionName);

  } finally {
    await apiContext.dispose();
  }
}
