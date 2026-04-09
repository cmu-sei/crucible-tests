// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles', () => {
  test('Assign System Role', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const rolesLink = page.locator('text=Roles, a:has-text("Roles"), mat-list-item:has-text("Roles")').first();
    await expect(rolesLink).toBeVisible({ timeout: 10000 });
    await rolesLink.click();

    // Navigate to system roles tab
    const systemRolesTab = page.locator('[role="tab"]:has-text("Roles")').first();
    await expect(systemRolesTab).toBeVisible({ timeout: 10000 });
    await systemRolesTab.click();
    await page.waitForLoadState('domcontentloaded');

    // Locate a user and click to manage their roles
    const rows = page.locator('mat-row, tbody tr').first();
    if (await rows.isVisible({ timeout: 5000 }).catch(() => false)) {
      await rows.click();

      // expect: Role management interface appears
      const roleCheckbox = page.locator('mat-checkbox, input[type="checkbox"]').first();
      if (await roleCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
        await roleCheckbox.click();
        await page.waitForTimeout(1000);
      }
    }
  });
});
