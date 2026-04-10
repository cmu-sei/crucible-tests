// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak, Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Role-Based Access - Non-Admin Restricted', async ({ page }) => {

    // 1. Log in as user without admin role (user1 has no Administrator role, only default-roles-crucible)
    await authenticateTopoMojoWithKeycloak(page, 'user1', 'user1');

    // expect: User is authenticated
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Attempt to navigate to /admin route
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // expect: Access is denied
    // expect: User is redirected away from /admin OR shown error message
    // Wait for either redirect or error message to appear
    await Promise.race([
      page.waitForURL((url) => !url.pathname.includes('/admin'), { timeout: 5000 }),
      page.locator('[class*="error"], [class*="denied"], [class*="unauthorized"]').first().waitFor({ state: 'visible', timeout: 5000 })
    ]).catch(() => {
      // If neither happens within timeout, that's also a valid check - we'll verify below
    });

    // expect: Admin interface is not accessible (user is redirected or sees error)
    const isRedirected = !page.url().includes('/admin');
    const errorMessage = page.locator('[class*="error"], [class*="denied"], [class*="unauthorized"]').first();
    const hasError = await errorMessage.isVisible({ timeout: 1000 }).catch(() => false);

    expect(isRedirected || hasError).toBe(true);
  });
});
