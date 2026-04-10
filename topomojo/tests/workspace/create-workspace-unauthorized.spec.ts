// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Workspace Management', () => {
  // FIXME: Test requires non-admin user credentials to be properly configured in Keycloak
  // Issue: user1 account in the Keycloak realm has a password hash that doesn't correspond to "user1".
  // Attempts to login with user1/user1 fail with "Invalid username or password" from Keycloak.
  //
  // The password needs to be properly set in Keycloak for this test to work. See the FIXME comment
  // in topomojo/tests/authentication/admin-access-unauthorized.spec.ts for detailed fix options.
  test.fixme('Create Workspace - Unauthorized User', async ({ page }) => {

    // 1. Log in as user without creator role
    // FIXME: user1/user1 credentials fail - password hash in realm doesn't match "user1"
    await authenticateTopoMojoWithKeycloak(page, 'user1', 'user1');

    // expect: User is on home page
    await expect(page).toHaveURL(/localhost:4201/);

    // Open sidebar if needed
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // 2. Look for 'Create Workspace' button
    const createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has(mat-icon:text("add"))').first();

    // expect: Create workspace button is not visible or is disabled
    const isVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (isVisible) {
      await expect(createButton).toBeDisabled();
    }
  });
});
