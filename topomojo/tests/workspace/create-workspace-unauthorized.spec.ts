// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateTopoMojoWithKeycloak } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Workspace Management', () => {
  test('Create Workspace - Unauthorized User', async ({ page }) => {

    // 1. Log in as user without creator role
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
