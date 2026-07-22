// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services } from '../shared-fixtures';

/**
 * Moodle-specific authentication helper.
 *
 * Moodle does not redirect directly to Keycloak from every protected page. The
 * login page presents an identity-provider link first, then Keycloak handles the
 * credential prompt.
 */
export async function authenticateMoodleWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await page.goto(`${Services.Moodle}/login/index.php`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (await page.locator('#user-menu-toggle, [data-region="usermenu"]').first().isVisible().catch(() => false)) {
    return;
  }

  const identityProvider = page.getByRole('link', { name: /Crucible Keycloak/i });
  await identityProvider.waitFor({ state: 'visible', timeout: 30000 });
  await identityProvider.click();

  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  const submit = page.locator('button:has-text("Sign In"), input[type="submit"], button[type="submit"]').first();
  await submit.click();

  const moodleHost = new URL(Services.Moodle).host;
  await page.waitForURL((url) => url.host === moodleHost && !url.pathname.includes('/login/index.php'), {
    timeout: 30000,
  });
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.locator('#user-menu-toggle, [data-region="usermenu"]').first().waitFor({ state: 'visible', timeout: 30000 });
}

export type MoodleFixtures = {
  moodleAdminPage: Page;
  moodleDemoUserPage: Page;
};

export const test = base.extend<MoodleFixtures>({
  moodleAdminPage: async ({ page }, use) => {
    await authenticateMoodleWithKeycloak(page, 'admin', 'admin');
    await use(page);
  },

  moodleDemoUserPage: async ({ page }, use) => {
    await authenticateMoodleWithKeycloak(page, 'demo-user', 'tartans@1');
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
