// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Management in Admin', () => {
  test('View User Details', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Users').first().click();
    await page.waitForTimeout(1000);

    // Click on a user to view details
    const userRow = page.locator('tr:has-text("admin"), mat-list-item:has-text("admin"), [class*="user-row"]:has-text("admin")').first();
    await expect(userRow).toBeVisible({ timeout: 10000 });
    await userRow.click();
    await page.waitForTimeout(1000);

    // Verify detail view with username/name/email/role info
    const detailView = page.locator('[class*="detail"], [class*="user-detail"], mat-card, mat-expansion-panel').first();
    await expect(detailView).toBeVisible({ timeout: 10000 });

    // Check that user information fields are present
    const nameField = page.locator('text=/name|username/i').first();
    await expect(nameField).toBeVisible({ timeout: 5000 });
  });
});
