// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../../shared-fixtures';
import { authenticateGameboardWithKeycloak } from '../../fixtures';
import {
  getKeycloakAdminToken,
  createKeycloakUser,
  deleteKeycloakUser,
  tempUsername,
} from '../../../keycloak-admin';

// Creates a fresh Keycloak user with no elevated roles, logs in as that user,
// and verifies they cannot access the Gameboard admin dashboard.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin - Games', () => {
  let adminToken: string;
  let userId: string | null = null;
  const password = 'non-admin-pass';
  let username = '';

  test.beforeEach(async () => {
    adminToken = await getKeycloakAdminToken();
    username = tempUsername('nonadmin');
    const user = await createKeycloakUser(adminToken, { username, password });
    userId = user.id;
  });

  test.afterEach(async () => {
    if (userId) await deleteKeycloakUser(adminToken, userId);
  });

  test('Admin Dashboard Access - Unauthorized', async ({ page }) => {
    // Log in as the non-admin user via the Gameboard-aware helper that
    // navigates to /admin first (which triggers the login flow since
    // Gameboard's home page is public).
    await authenticateGameboardWithKeycloak(page, username, password);

    // Non-admin lands on /admin/dashboard? Keycloak grants a token but the
    // backend enforces role-based permissions. The admin tabs (Live/Games/Users)
    // should NOT be present in the nav.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(3000);

    // A non-admin should not see the admin sub-tabs (Games/Users/Practice Area).
    await expect(page.locator('a[href="/admin/registrar/users"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/overview"]')).toHaveCount(0);
  });
});
