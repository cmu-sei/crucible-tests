// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import fs from 'fs';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
} from '../shared-fixtures';
import { authSessionStatePath, authStatePath } from '../auth-paths';

/**
 * Blueprint-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateBlueprintWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Blueprint.UI, username, password);
}

/**
 * Blueprint-specific fixtures
 */
export type BlueprintFixtures = {
  blueprintAuthenticatedPage: Page;
};

/**
 * Path to the Blueprint storageState saved by global-setup.ts. May not exist if the
 * global setup failed to provision (stack down at startup) — handled below.
 */
const blueprintStatePath = authStatePath('blueprint');
const blueprintStateExists = fs.existsSync(blueprintStatePath);
const blueprintSessionStatePath = authSessionStatePath('blueprint');
const blueprintSessionState: Array<[string, string]> = fs.existsSync(blueprintSessionStatePath)
  ? JSON.parse(fs.readFileSync(blueprintSessionStatePath, 'utf8'))
  : [];

/**
 * Extended test with Blueprint-specific fixtures.
 *
 * `storageState` defaults to the pre-authenticated state captured once by
 * global-setup.ts, so every spec's browser context starts with a valid OIDC token.
 * The `blueprintAuthenticatedPage` fixture then just navigates and waits for the
 * Angular shell — no per-test Keycloak round-trip. Auth-flow specs opt out with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export const test = base.extend<BlueprintFixtures>({
  // Reuse the authenticated state captured by global-setup. Authentication specs
  // opt out with an empty storageState and retain the interactive login flow.
  storageState: blueprintStateExists ? blueprintStatePath : undefined,

  blueprintAuthenticatedPage: async ({ page, storageState }, use) => {
    // Restore sessionStorage if it was captured during global-setup. The OIDC client
    // may store its token in sessionStorage (like Player) or localStorage (captured
    // by storageState), so we restore both to handle either case.
    if (storageState === blueprintStatePath && blueprintSessionState.length > 0) {
      await page.addInitScript((entries: Array<[string, string]>) => {
        for (const [key, value] of entries) {
          sessionStorage.setItem(key, value);
        }
      }, blueprintSessionState);
    }

    // Fast path: storageState already carries a valid token, so navigating home
    // should render the authenticated shell without redirecting to Keycloak.
    await page.goto(Services.Blueprint.UI, { waitUntil: 'domcontentloaded' });

    const appShell = page.locator('app-root mat-toolbar').first();
    const keycloakField = page.locator('input[name="username"]');

    // Race the authenticated shell against a Keycloak login form. The form appears
    // only if the saved state is missing/expired — in that case fall back to the
    // full interactive login so the test still proceeds (just not as fast).
    const winner = await waitForFirstVisible(
      page,
      [
        { key: 'shell', locator: appShell },
        { key: 'keycloak', locator: keycloakField },
      ],
      { timeout: 20000 }
    );

    if (winner !== 'shell') {
      // Either Keycloak appeared or neither did within the window — do a full login.
      await authenticateBlueprintWithKeycloak(page);
      await appShell.waitFor({ state: 'visible', timeout: 30000 });
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible };
