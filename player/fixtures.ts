// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

export async function authenticatePlayerWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

export type PlayerFixtures = {
  playerAuthenticatedPage: Page;
};

export const test = base.extend<PlayerFixtures>({
  playerAuthenticatedPage: async ({ page }, use) => {
    await authenticatePlayerWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
