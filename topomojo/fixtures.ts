// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

/**
 * TopoMojo-specific fixtures
 * Extends shared fixtures with TopoMojo authentication
 */

/**
 * TopoMojo-specific authentication helper
 * TopoMojo has a landing page with a login button that must be clicked to redirect to Keycloak
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateTopoMojoWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  console.log(`Authenticating TopoMojo with Keycloak for ${Services.TopoMojo.UI}...`);

  // Navigate to TopoMojo
  console.log(`Navigating to ${Services.TopoMojo.UI}...`);
  await page.goto(Services.TopoMojo.UI, { timeout: 180000, waitUntil: 'domcontentloaded' });

  // Check if we're already on Keycloak (direct redirect)
  const currentUrl = page.url();
  const keycloakHost = new URL(Services.Keycloak).host;
  const isOnKeycloak = currentUrl.includes(keycloakHost) || currentUrl.includes('/realms/crucible');

  if (!isOnKeycloak) {
    // TopoMojo shows a landing page with a login button - look for it
    // Race condition: check for both login button (unauthenticated) and auth content (authenticated)
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    const authenticatedButton = page.locator('button:has-text("Admin"), button:has-text("Logout")');

    // Wait for either login button or authenticated content to appear
    try {
      const winner = await Promise.race([
        loginButton.waitFor({ state: 'visible', timeout: 15000 }).then(() => 'login' as const),
        authenticatedButton.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'authenticated' as const),
      ]);

      if (winner === 'login') {
        console.log(`TopoMojo landing page detected - clicking login button...`);
        await loginButton.click();
        // Wait for redirect to Keycloak
        await page.waitForURL((url) => url.host.includes(keycloakHost) || url.pathname.includes('/realms/crucible'), { timeout: 30000 });
      } else {
        console.log(`Already authenticated on TopoMojo`);
        return;
      }
    } catch (error: any) {
      throw new Error(`TopoMojo page loaded but neither login button nor authenticated content appeared within timeout. Error: ${error.message}`);
    }
  }

  // Now we should be on Keycloak - perform login
  console.log(`Keycloak login page detected, logging in...`);
  await page.waitForSelector('input[name="username"]', { timeout: 30000 });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  try {
    await page.click('button:has-text("Sign In")', { timeout: 2000 });
  } catch {
    await page.click('input[type="submit"]');
  }

  // Wait for redirect back to TopoMojo
  const topomojoHost = new URL(Services.TopoMojo.UI).host;
  await page.waitForURL((url) => url.host === topomojoHost, { timeout: 30000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

  // Wait for OIDC callback to complete - the URL may contain /oidc?state=... temporarily
  // Wait for it to resolve to a clean URL (no /oidc in path)
  try {
    await page.waitForURL((url) => !url.pathname.includes('/oidc'), { timeout: 10000 });
  } catch {
    // If still on /oidc, the callback may be processing - wait for navigation
    console.log(`Still on OIDC callback URL, waiting for redirect...`);
  }

  // Wait for authenticated app content to appear (not the landing page)
  // Look for authenticated elements like Admin/Logout buttons or navigation
  const authenticatedContent = page.locator('button:has-text("Admin"), button:has-text("Logout"), navigation, searchbox, [role="searchbox"]');
  await authenticatedContent.first().waitFor({ state: 'visible', timeout: 30000 });

  console.log(`Successfully authenticated and returned to TopoMojo`);
}

/**
 * TopoMojo-specific fixtures
 */
export type TopoMojoFixtures = {
  topomojoAuthenticatedPage: Page;
};

/**
 * Extended test with TopoMojo-specific fixtures
 */
export const test = base.extend<TopoMojoFixtures>({
  topomojoAuthenticatedPage: async ({ page }, use) => {
    await authenticateTopoMojoWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
