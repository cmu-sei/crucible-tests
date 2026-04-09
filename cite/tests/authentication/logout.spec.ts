// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  test('Logout Functionality', async ({ citeAuthenticatedPage: page }) => {

    // 1. Log in with valid credentials (admin/admin)
    // expect: User is successfully authenticated
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });

    // 2. Click on user profile menu in top bar
    const userMenuButton = page.locator('[class*="user-menu"], [class*="profile"], button:has-text("admin"), [matMenuTriggerFor]').first();
    await userMenuButton.click();

    // expect: User menu dropdown opens
    const menuPanel = page.locator('mat-menu, .mat-menu-panel, [role="menu"]');
    await expect(menuPanel).toBeVisible({ timeout: 5000 });

    // 3. Click 'Logout' or 'Sign Out' option
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Log Out")').first();
    await logoutButton.click();

    // expect: User is logged out
    // expect: User is redirected to Keycloak or CITE home
    await page.waitForURL(/localhost:8443|localhost:4721/, { timeout: 30000 });

    // expect: Authentication session is terminated
    // 4. Attempt to navigate to CITE UI again
    await page.goto(Services.Cite.UI);

    // expect: User is redirected to Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443/, { timeout: 70000 });

    // expect: User must authenticate again
    const usernameField = page.locator('#username');
    await expect(usernameField).toBeVisible({ timeout: 10000 });
  });
});
