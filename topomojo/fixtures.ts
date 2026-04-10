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
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateTopoMojoWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.TopoMojo.UI, username, password);
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
