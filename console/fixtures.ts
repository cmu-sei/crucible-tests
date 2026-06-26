// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, expect, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';
import { getAllViewIds } from '../playerVm/fixtures';

export async function authenticateConsoleWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // The Console UI has no listing of its own; authenticate via Player (where
  // the view/VM lists live) and let the Keycloak SSO session carry over to the
  // Console UI. The Console UI uses its own OIDC client, so the first
  // navigation to it may still perform a silent redirect — handled by
  // authenticateWithKeycloak.
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

/**
 * Discovers the id of the first VM found in any of the user's views by reading
 * the Player VM UI's VM list, which links each VM to its console at
 * `.../vm/{vmId}/console`. Scans views in order and returns the first VM id
 * found, or null if no view contains a VM. Assumes the page is authenticated
 * and currently on the Player UI home.
 */
export async function getFirstVmId(page: Page): Promise<string | null> {
  const viewIds = await getAllViewIds(page);

  for (const viewId of viewIds) {
    await page.goto(`${Services.PlayerVM.UI}/views/${viewId}`);

    const consoleLink = page
      .locator('a[href*="/vm/"][href*="/console"]')
      .first();
    try {
      await consoleLink.waitFor({ state: 'attached', timeout: 15000 });
    } catch {
      continue; // this view has no VMs; try the next
    }

    const href = await consoleLink.getAttribute('href');
    const match = href?.match(/\/vm\/([0-9a-fA-F-]{36})\/console/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export type ConsoleFixtures = {
  consoleAuthenticatedPage: Page;
};

export const test = base.extend<ConsoleFixtures>({
  consoleAuthenticatedPage: async ({ page }, use) => {
    await authenticateConsoleWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
