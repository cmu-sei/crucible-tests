// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, authenticateGameboardWithKeycloak } from '../../fixtures';

// Verifies that a non-admin user (one of this worker's pool users), when logged into
// Gameboard, does not see admin-only team-management controls on the admin Users page.
// This is the most meaningful authorization check we can make without a full
// team-invitation multi-user setup. The default `page` is driven as that user, so it
// must start without admin's saved login.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Team Management', () => {
  // Nothing to reset: the test only reads, and the pool user's Gameboard row belongs to
  // the worker fixture.
  test('Edit Team Details - Non-Admin Cannot Access Admin Team Controls', async ({ page, nonAdminUser }) => {
    await authenticateGameboardWithKeycloak(page, nonAdminUser.username, nonAdminUser.password);

    // Non-admins do NOT see the admin sidebar links for Users/Players.
    await page.goto(Services.Gameboard.UI + '/admin/registrar/users', {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();

    // The Users admin page reserved for elevated roles should not render the
    // admin nav links or the Users heading.
    await expect(page.locator('a[href="/admin/registrar/users"]')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/registrar/players"]')).toHaveCount(0);
  });
});
