// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Locator, Page } from '@playwright/test';
import { Services, serviceUrlPattern, oidcStorageKey, authenticateWithKeycloak, waitForFirstVisible, ensureAuthenticatedShell } from '../shared-fixtures';
import { freshAuthStatePath } from '../auth-state';
import { authStatePath } from '../auth-paths';

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
  // Navigate to TopoMojo
  await page.goto(Services.TopoMojo.UI, { timeout: 180000, waitUntil: 'domcontentloaded' });

  // Check if we're already on Keycloak (direct redirect)
  const currentUrl = page.url();
  const keycloakHost = new URL(Services.Keycloak).host;
  const isOnKeycloak = currentUrl.includes(keycloakHost) || currentUrl.includes('/realms/crucible');

  if (!isOnKeycloak) {
    // TopoMojo shows a landing page with a login button - wait for either the login
    // button (unauthenticated) or the authenticated content (already signed in).
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'login', locator: loginButton },
        { key: 'authenticated', locator: topomojoNavLink(page, 'Logout') },
      ],
      { timeout: 15000 },
    );

    if (winner === 'authenticated') {
      return;
    } else if (winner === 'login') {
      await loginButton.click();
      // Wait for redirect to Keycloak OR authenticated shell (if session is still valid).
      // With a valid session, clicking the button processes the existing session via
      // OIDC without visiting Keycloak.
      const afterClick = await waitForFirstVisible(
        page,
        [
          { key: 'keycloak', locator: page.locator('input[name="username"]') },
          { key: 'authenticated', locator: topomojoNavLink(page, 'Logout') },
        ],
        { timeout: 30000 },
      );
      if (afterClick === 'authenticated') {
        // Session was valid - already authenticated
        return;
      }
      // afterClick === 'keycloak' - continue with login flow below
    } else {
      throw new Error(`TopoMojo page loaded but neither login button nor authenticated content appeared within timeout.`);
    }
  }

  // Reached when the app redirected straight to Keycloak, or the login button led
  // there; the waitForSelector below fails if we're not actually on Keycloak.
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
  }

  // Wait for authenticated app content to appear (not the landing page): the top bar
  // only offers Logout once the user is signed in.
  await topomojoNavLink(page, 'Logout').waitFor({ state: 'visible', timeout: 30000 });
}

/**
 * A link in TopoMojo's top bar. Home, About, Admin (admins only), Observe (observers
 * who are not admins) and Logout (any signed-in user) are all links: topomojo-ui #85
 * turned Admin, Observe and Logout from buttons into links, so look them up by the
 * link role rather than as buttons.
 */
export function topomojoNavLink(
  page: Page,
  name: 'Home' | 'About' | 'Admin' | 'Observe' | 'Logout'
): Locator {
  return page.locator('nav.navbar').getByRole('link', { name, exact: true });
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
  // `undefined` when global-setup could not provision TopoMojo; the shell check below
  // then falls back to an interactive login.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('topomojo', browser)),

  topomojoAuthenticatedPage: async ({ page, storageState }, use) => {
    // TopoMojo shows a landing page with a "Sign in with identity provider" button when
    // unauthenticated (no direct Keycloak redirect), so pass loginPrompt. The button can
    // flash briefly even with valid auth while the JS auth check runs, but ensureAuthenticatedShell's
    // loginPromptSettleMs re-wait distinguishes the flash from genuine unauthenticated state.
    await ensureAuthenticatedShell(page, {
      app: 'topomojo',
      url: Services.TopoMojo.UI,
      shell: topomojoNavLink(page, 'Logout'),
      login: authenticateTopoMojoWithKeycloak,
      loginPrompt: page.getByRole('button', { name: 'identity provider' }),
      fromSavedState: storageState === authStatePath('topomojo'),
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible };
