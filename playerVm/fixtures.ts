// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

const VIEW_LINK = 'a[href^="/view/"]';

export async function authenticatePlayerVmWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Authenticate against Player UI: the Player VM UI has no view list of its
  // own (its root renders "View Not Found"), so we land on Player to discover
  // a real view id. The Keycloak SSO session then carries over to the Player
  // VM UI on the next navigation.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

/**
 * Returns the id of the first view in the authenticated user's "My Views"
 * list, or null if the user has no views. Assumes the page is already on the
 * Player UI home (i.e. authenticatePlayerVmWithKeycloak has run).
 */
export async function getFirstViewId(page: Page): Promise<string | null> {
  const ids = await getAllViewIds(page);
  return ids.length > 0 ? ids[0] : null;
}

/**
 * Returns the ids of all views in the authenticated user's "My Views" list
 * (across all pages of the table is not handled — only the first page is read,
 * which is sufficient for the seeded dev/test data). Assumes the page is on
 * the Player UI home.
 */
export async function getAllViewIds(page: Page): Promise<string[]> {
  await expect(page.getByText('My Views')).toBeVisible({ timeout: 30000 });
  const links = page.locator(VIEW_LINK);
  const count = await links.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href');
    const match = href?.match(/\/view\/([0-9a-fA-F-]{36})/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
}

export type PlayerVmFixtures = {
  playerVmAuthenticatedPage: Page;
};

export const test = base.extend<PlayerVmFixtures>({
  playerVmAuthenticatedPage: async ({ page }, use) => {
    await authenticatePlayerVmWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
