// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

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

// Console specs get their VM id from `playerVm/vm-helpers.ts` (`seedViewWithVm`),
// not from scraping the VM list for whatever machine the environment happens to
// have. Discovery made the spec skip itself when no VM turned up, which reads as
// a pass while asserting nothing about the console.

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
