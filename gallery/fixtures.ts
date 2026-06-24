// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { Services, serviceUrlPattern, oidcStorageKey, authenticateWithKeycloak } from '../shared-fixtures';

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
 * Worker-scoped fixtures for seeded test data.
 * Seeded data is created once per worker and shared across all tests in that worker.
 */
export type GalleryWorkerFixtures = {
  seededExhibit: SeededExhibitData;
};

/**
 * Extended test with Gallery-specific fixtures
 */
export const test = base.extend<GalleryFixtures, GalleryWorkerFixtures>({
  galleryAuthenticatedPage: async ({ page }, use) => {
    await authenticateGalleryWithKeycloak(page);
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
    const teamResponse = await apiContext.post(`${Services.Gallery.API}/api/teams`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: teamName,
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

    // Create 3 cards at different moves/injects with 2 articles each
    const cardData = [
      { move: 0, inject: 0, name: 'Test Card 1', articles: [
        { name: 'Intel Article 1', sourceType: 0, summary: 'E2E test intel article' },
        { name: 'News Article 1', sourceType: 3, summary: 'E2E test news article' }
      ]},
      { move: 1, inject: 0, name: 'Test Card 2', articles: [
        { name: 'Reporting Article 1', sourceType: 1, summary: 'E2E test reporting article' },
        { name: 'Social Article 1', sourceType: 4, summary: 'E2E test social article' }
      ]},
      { move: 1, inject: 1, name: 'Test Card 3', articles: [
        { name: 'Orders Article 1', sourceType: 2, summary: 'E2E test orders article' },
        { name: 'Email Article 1', sourceType: 6, summary: 'E2E test email article' }
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

        // Link Article to Team
        // Note: The API may return 500 if a duplicate record already exists.
        // Since cleanup deletes the entire exhibit (which cascades), we can safely skip
        // tracking failed TeamArticle creations.
        try {
          const teamArticleResponse = await apiContext.post(`${Services.Gallery.API}/api/teamarticles`, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            data: {
              exhibitId: exhibit.id,
              teamId: team.id,
              articleId: article.id,
            },
          });

          if (teamArticleResponse.ok()) {
            const teamArticle: { id: string } = await teamArticleResponse.json();
            teamArticleIds.push(teamArticle.id);
            console.log(`Linked article to team (TeamArticle ID: ${teamArticle.id})`);
          } else {
            const errorText = await teamArticleResponse.text();
            // If it's a duplicate error, log a warning but continue (cleanup will handle it via cascade)
            if (teamArticleResponse.status() === 500 && errorText.includes('already exists')) {
              console.warn(`TeamArticle for article ${article.id} already exists, skipping (cleanup will handle via cascade)`);
            } else {
              throw new Error(`Failed to link article to team: ${teamArticleResponse.status()} ${errorText}`);
            }
          }
        } catch (error: any) {
          // If it's a duplicate error, log and continue
          if (error.message?.includes('already exists')) {
            console.warn(`TeamArticle creation skipped due to duplicate: ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }

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
