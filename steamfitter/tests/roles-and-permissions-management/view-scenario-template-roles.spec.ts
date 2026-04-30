// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Roles and Permissions Management', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try { await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`); } catch {}
    }
  });

  test('View Scenario Template Roles', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template via API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Roles View', description: 'Template for viewing roles', durationHours: 1 },
    });
    expect(tResp.ok()).toBeTruthy();
    const template = await tResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Navigate to the template
    await page.locator('text=Template Roles View').first().click();
    await page.waitForTimeout(1000);

    // View roles/permissions tab
    const rolesTab = page.locator('mat-tab:has-text("Roles"), [role="tab"]:has-text("Roles"), a:has-text("Roles"), button:has-text("Roles"), text=Permissions').first();
    const hasRolesTab = await rolesTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasRolesTab) {
      await rolesTab.click();
      await page.waitForTimeout(1000);
    }

    // Verify roles/permissions section is visible
    const rolesSection = page.locator('[class*="role"], [class*="permission"], mat-list, table').first();
    await expect(rolesSection).toBeVisible({ timeout: 10000 });
  });
});
