// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak, Services, serviceUrlPattern, topomojoNavLink } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Role-Based Access - Non-Admin Restricted', async ({ page }) => {

    // 1. Log in as user without admin role (user1 has no Administrator role, only default-roles-crucible)
    await authenticateTopoMojoWithKeycloak(page, 'user1', 'user1');

    // expect: User is authenticated
    await expect(page).toHaveURL(serviceUrlPattern(Services.TopoMojo.UI));

    // 2. Attempt to navigate to /admin route
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // expect: Access is denied
    // expect: TopoMojo stays on /admin but renders non-admin nav (Home visible, Admin absent)
    await expect(topomojoNavLink(page, 'Home')).toBeVisible({ timeout: 10000 });
    await expect(topomojoNavLink(page, 'Admin')).toHaveCount(0);
  });
});
