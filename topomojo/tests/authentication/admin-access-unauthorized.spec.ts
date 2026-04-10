// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak, Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Role-Based Access - Non-Admin Restricted', async ({ page }) => {

    // 1. Log in as user without admin role
    await authenticateTopoMojoWithKeycloak(page, 'user1', 'user1');

    // expect: User is authenticated
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Attempt to navigate to /admin route
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // expect: Access is denied
    // expect: User is redirected or shown error message
    // expect: Admin interface is not accessible
    const isRedirected = !page.url().includes('/admin');
    const errorMessage = page.locator('[class*="error"], [class*="denied"], [class*="unauthorized"]').first();
    const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false);

    expect(isRedirected || hasError).toBe(true);
  });
});
