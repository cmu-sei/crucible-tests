// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { Services } from '../../../shared-fixtures';
import { test, expect, authenticateGameboardWithKeycloak } from '../../fixtures';

// Logs in as one of this worker's pool users (no elevated roles) and verifies they
// cannot access the Gameboard admin dashboard. The default `page` is driven as that
// user, so it must start without admin's saved login.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Admin - Games', () => {
  // Nothing to reset: the test only reads, and the pool user's Gameboard row belongs to
  // the worker fixture.
  test('Admin Dashboard Access - Unauthorized', async ({ page, nonAdminUser }) => {
    // Log in as the non-admin user via the Gameboard-aware helper that
    // navigates to /admin first (which triggers the login flow since
    // Gameboard's home page is public).
    await authenticateGameboardWithKeycloak(page, nonAdminUser.username, nonAdminUser.password);

    // Non-admin lands on /admin/dashboard? Keycloak grants a token but the
    // backend enforces role-based permissions. The admin tabs (Live/Games/Users)
    // should NOT be present in the nav.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();

    // A non-admin should not see the admin sub-tabs (Games/Users/Practice Area).
    await expect(page.locator('a[href="/admin/registrar/users"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/overview"]')).toHaveCount(0);
  });
});
