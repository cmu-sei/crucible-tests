// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Persistence After Refresh', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in with valid credentials (admin/admin) - handled by fixture
    // expect: User is successfully authenticated and viewing TopoMojo home page
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Refresh the browser page
    await page.reload();

    // expect: User remains authenticated
    // expect: Home page loads without redirecting to Keycloak
    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/localhost:8443/);

    // expect: User session is maintained
    const appContent = page.locator('app-root, mat-toolbar, [class*="topbar"], nav, header').first();
    await expect(appContent).toBeVisible({ timeout: 15000 });
  });
});
