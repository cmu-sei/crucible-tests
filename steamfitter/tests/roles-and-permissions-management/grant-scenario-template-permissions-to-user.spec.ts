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

  test('Grant Scenario Template Permissions to User', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create template via API
    const tResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Template Grant Perms', description: 'Template for granting permissions', durationHours: 1 },
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
    await page.locator('text=Template Grant Perms').first().click();
    await page.waitForTimeout(1000);

    // Navigate to roles/permissions tab
    const rolesTab = page.locator('mat-tab:has-text("Roles"), [role="tab"]:has-text("Roles"), a:has-text("Roles"), button:has-text("Roles"), text=Permissions').first();
    const hasRolesTab = await rolesTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasRolesTab) {
      await rolesTab.click();
      await page.waitForTimeout(1000);
    }

    // Add user with permissions
    const addUserButton = page.locator('button:has-text("Add"), button:has(mat-icon:text("add")), button:has(mat-icon:text("person_add"))').first();
    await expect(addUserButton).toBeVisible({ timeout: 10000 });
    await addUserButton.click();
    await page.waitForTimeout(500);

    // Select a user
    const userOption = page.locator('mat-option, [role="option"], mat-list-item').first();
    await expect(userOption).toBeVisible({ timeout: 10000 });
    await userOption.click();
    await page.waitForTimeout(500);

    // Select View permission
    const viewPerm = page.locator('mat-checkbox:has-text("View"), label:has-text("View"), [class*="permission"]:has-text("View")').first();
    const hasViewPerm = await viewPerm.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasViewPerm) {
      await viewPerm.click();
    }

    // Select Execute permission
    const executePerm = page.locator('mat-checkbox:has-text("Execute"), label:has-text("Execute"), [class*="permission"]:has-text("Execute")').first();
    const hasExecutePerm = await executePerm.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasExecutePerm) {
      await executePerm.click();
    }

    // Save
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply"), button[type="submit"]').first();
    const hasSave = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasSave) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
