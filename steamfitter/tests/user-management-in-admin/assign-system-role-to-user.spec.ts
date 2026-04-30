// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('User Management in Admin', () => {
  test.afterEach(async ({ request }) => {
    // No specific cleanup needed as role assignment is non-destructive
  });

  test('Assign System Role to User', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Users').first().click();
    await page.waitForTimeout(1000);

    // Select a user
    const userRow = page.locator('tr, mat-list-item, [class*="user-row"]').first();
    await expect(userRow).toBeVisible({ timeout: 10000 });
    await userRow.click();
    await page.waitForTimeout(1000);

    // Find role dropdown and select 'Content Developer'
    const roleDropdown = page.locator('mat-select, select, [class*="role"]').first();
    await expect(roleDropdown).toBeVisible({ timeout: 10000 });
    await roleDropdown.click();
    await page.waitForTimeout(500);

    const contentDevOption = page.locator('mat-option:has-text("Content Developer"), option:has-text("Content Developer"), [role="option"]:has-text("Content Developer")').first();
    await contentDevOption.click();
    await page.waitForTimeout(1000);

    // Verify assignment
    await expect(page.locator('text=Content Developer').first()).toBeVisible({ timeout: 10000 });
  });
});
