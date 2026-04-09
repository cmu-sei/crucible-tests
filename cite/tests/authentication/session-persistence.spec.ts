// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Persistence After Refresh', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in with valid credentials (admin/admin)
    // expect: User is successfully authenticated and viewing CITE home page
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Refresh the browser page
    await page.reload();

    // expect: User remains authenticated
    // expect: Home page loads without redirecting to Keycloak
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // expect: User session is maintained
    const userMenu = page.locator('[class*="user"], [class*="profile"], mat-toolbar').first();
    await expect(userMenu).toBeVisible({ timeout: 10000 });
  });
});
