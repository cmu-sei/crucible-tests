// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Logout Functionality', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in with valid credentials (admin/admin) - handled by fixture
    // expect: User is successfully authenticated
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Click 'Logout' button in top navigation
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), [class*="logout"], button:has(mat-icon:text("logout"))').first();
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await logoutButton.click();

    // expect: User is logged out
    // expect: User is redirected to login or home page
    await page.waitForTimeout(3000);

    // 3. Attempt to navigate to TopoMojo UI again
    await page.goto(Services.TopoMojo.UI);

    // expect: User sees the landing page with login button
    // expect: User must authenticate again (TopoMojo shows landing page, not auto-redirect to Keycloak)
    await page.waitForLoadState('domcontentloaded');
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    const loginText = page.locator('text=Please login to continue');
    await expect(loginText).toBeVisible({ timeout: 5000 });
  });
});
