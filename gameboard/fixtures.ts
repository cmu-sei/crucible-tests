// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

/**
 * Gameboard-specific fixtures
 * Extends shared fixtures with Gameboard authentication
 */

/**
 * Gameboard-specific authentication helper.
 *
 * Unlike most Crucible apps, Gameboard's home page is PUBLIC - unauthenticated
 * users can browse games without being redirected to Keycloak. Authentication
 * is only triggered when navigating to a protected route (e.g. /admin), which
 * shows an in-app "Login — localhost:8443" button that initiates the OIDC flow.
 *
 * This helper navigates to /admin to force a login prompt, then completes the
 * Keycloak authentication form.
 *
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateGameboardWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  // Force login by navigating to a protected route.
  await page.goto(Services.Gameboard.UI + '/admin', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // If we are already authenticated (e.g. cookies persisted), /admin will not
  // redirect to /login — short-circuit.
  if (!/\/login\?/.test(page.url())) {
    // Still need to confirm the post-login nav is present.
    const alreadyAuthed = await page
      .locator('a:has-text("Log out"), button:has-text("Log out")')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (alreadyAuthed) return;
  }

  // Click the in-app Login button that redirects to Keycloak.
  const loginBtn = page.locator('button:has-text("Login"), button:has-text("Log in")').first();
  await loginBtn.waitFor({ state: 'visible', timeout: 30000 });
  await loginBtn.click();

  // Wait for Keycloak login page.
  await page.waitForURL(/\/realms\/crucible/, { timeout: 30000 });
  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Keycloak uses either a button or an input[type=submit] depending on theme.
  try {
    await page.click('button:has-text("Sign In")', { timeout: 3000 });
  } catch {
    try {
      await page.click('input[type="submit"]', { timeout: 3000 });
    } catch {
      await page.click('button[type="submit"]');
    }
  }

  // Wait for redirect back to Gameboard.
  await page.waitForURL(/localhost:4202/, { timeout: 30000 });
  // Confirm auth landed — "Log out" link is visible.
  await page
    .locator('a:has-text("Log out"), button:has-text("Log out")')
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * Gameboard-specific fixtures
 */
export type GameboardFixtures = {
  gameboardAuthenticatedPage: Page;
};

/**
 * Extended test with Gameboard-specific fixtures
 */
export const test = base.extend<GameboardFixtures>({
  gameboardAuthenticatedPage: async ({ page }, use) => {
    await authenticateGameboardWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
