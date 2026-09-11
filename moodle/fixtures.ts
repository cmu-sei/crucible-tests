// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, isKeycloakUrl } from '../shared-fixtures';

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

  // #user-menu-toggle renders only for a logged-in user. The [data-region="usermenu"]
  // wrapper is present even when logged out, so it can't be used to detect a session.
  if (await page.locator('#user-menu-toggle').first().isVisible().catch(() => false)) {
    return;
  }

  const identityProvider = page.getByRole('link', { name: /Crucible Keycloak/i });
  await identityProvider.waitFor({ state: 'visible', timeout: 30000 });
  await identityProvider.click();

  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  const submit = page.locator('button:has-text("Sign In"), input[type="submit"], button[type="submit"]').first();
  // The click waits for the navigation it schedules, which is Keycloak's token
  // exchange, Moodle's OAuth2 callback and finally the dashboard render. That chain
  // can outlast the action timeout on a busy stack, so a slow click is not treated as
  // fatal here: the URL and session checks below are what actually gate the login.
  await submit.click({ timeout: 30000 }).catch(() => undefined);

  // Under minikube, Moodle and Keycloak share a host, so a host-only check would pass
  // immediately while still on Keycloak. Wait until we're back on Moodle, off Keycloak,
  // and off the login page.
  const moodleHost = new URL(Services.Moodle).host;
  const backOnMoodle = await page
    .waitForURL(
      (url) => url.host === moodleHost && !isKeycloakUrl(url) && !url.pathname.includes('/login/index.php'),
      { timeout: 60000 }
    )
    .then(() => true)
    .catch(() => false);

  if (!backOnMoodle) {
    // Moodle's session is established by the OAuth2 callback, which runs before the
    // post-login redirect, so re-requesting a page recovers a stalled final hop
    // instead of failing a test for a slow dashboard.
    await page.goto(`${Services.Moodle}/my/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  // Verify the session actually established (see note above on #user-menu-toggle).
  await page.locator('#user-menu-toggle').first().waitFor({ state: 'visible', timeout: 30000 });
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

  // A non-instructor session, for asserting that a learner does not get the
  // instructor-only controls. Keycloak's own demo account is used rather than a
  // disposable user because the login goes through the identity provider, and a
  // DB-seeded Moodle user has no Keycloak credentials to log in with.
  moodleDemoUserPage: async ({ page }, use) => {
    await authenticateMoodleWithKeycloak(
      page,
      process.env.MOODLE_DEMO_USERNAME || 'demo-user',
      process.env.MOODLE_DEMO_PASSWORD || 'tartans@1'
    );
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
