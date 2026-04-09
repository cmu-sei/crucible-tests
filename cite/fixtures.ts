// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page } from '@playwright/test';
import { Services, authenticateWithKeycloak } from '../shared-fixtures';

/**
 * CITE-specific fixtures
 * Extends shared fixtures with CITE authentication
 */

/**
 * CITE-specific authentication helper
 * @param page - Playwright Page object
 * @param username - Keycloak username (default: 'admin')
 * @param password - Keycloak password (default: 'admin')
 */
export async function authenticateCiteWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Cite.UI, username, password);
}

/**
 * CITE-specific fixtures
 */
export type CiteFixtures = {
  citeAuthenticatedPage: Page;
};

/**
 * Extended test with CITE-specific fixtures
 */
export const test = base.extend<CiteFixtures>({
  citeAuthenticatedPage: async ({ page }, use) => {
    await authenticateCiteWithKeycloak(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
export { Services };
