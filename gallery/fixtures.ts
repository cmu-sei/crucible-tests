// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

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
// API-based collection cleanup
// ========================================================================

/**
 * Delete a collection by ID via the Gallery API.
 * The Gallery DELETE /api/collections/{id} endpoint processes the deletion
 * but never returns a response, so we fire the DELETE and then poll GET
 * to confirm it was actually removed.
 */
async function deleteCollectionViaApi(apiContext: APIRequestContext, token: string, collectionId: string, collectionName: string): Promise<void> {
  // Fire the DELETE request but don't wait for the response (it never comes)
  const deletePromise = apiContext.delete(`${Services.Gallery.API}/api/collections/${collectionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 2000,
  }).catch(() => {
    // Expected: the DELETE endpoint hangs/times out, but the server still processes it
  });
  await deletePromise;

  // Poll the GET endpoint to confirm deletion
  const maxAttempts = 10;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const checkResponse = await apiContext.get(`${Services.Gallery.API}/api/collections/${collectionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 5000,
    });
    if (checkResponse.status() === 404) {
      console.log(`API cleanup: Deleted collection "${collectionName}" (${collectionId})`);
      return;
    }
  }
  console.warn(`API cleanup: Collection "${collectionName}" (${collectionId}) may not have been deleted`);
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
 * Extended test with Gallery-specific fixtures
 */
export const test = base.extend<GalleryFixtures>({
  galleryAuthenticatedPage: async ({ page }, use) => {
    await authenticateGalleryWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
