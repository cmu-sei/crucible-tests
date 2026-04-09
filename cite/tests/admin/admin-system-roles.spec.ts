// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Roles', () => {
  test('View System Roles', async ({ citeAuthenticatedPage: page }) => {

    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const rolesLink = page.locator('text=Roles, a:has-text("Roles"), mat-list-item:has-text("Roles")').first();
    await expect(rolesLink).toBeVisible({ timeout: 10000 });
    await rolesLink.click();

    // Click on 'Roles' tab (system roles)
    const systemRolesTab = page.locator('[role="tab"]:has-text("Roles")').first();
    await expect(systemRolesTab).toBeVisible({ timeout: 10000 });
    await systemRolesTab.click();

    // expect: System roles are displayed
    await page.waitForLoadState('domcontentloaded');
    const content = page.locator('mat-table, table, [class*="role"], [class*="list"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });
});
