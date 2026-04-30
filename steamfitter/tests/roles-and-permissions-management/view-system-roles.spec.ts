// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  test('View System Roles', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Roles').first().click();
    await page.waitForTimeout(1000);

    // Verify Administrator, Content Developer, Observer visible
    await expect(page.locator('text=Administrator').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Content Developer').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Observer').first()).toBeVisible({ timeout: 10000 });
  });
});
