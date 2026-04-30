// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Scenario Templates Management', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
    }
  });

  test('Edit Scenario Template Details', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create a template via API
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Edit Test Template', description: 'Template to be edited', durationHours: 1 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;

    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Edit Test Template').first()).toBeVisible({ timeout: 10000 });

    const templateRow = page.locator('text=Edit Test Template').first();
    const menuButton = templateRow.locator('..').locator('button:has(mat-icon:text("more_vert")), button:has(mat-icon:text("edit")), [class*="menu"]').first();
    const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasMenu) {
      await menuButton.click();
      await page.waitForTimeout(300);
      const editOption = page.locator('button:has-text("Edit"), [role="menuitem"]:has-text("Edit")').first();
      await editOption.click();
    } else {
      await templateRow.click();
    }
    await page.waitForTimeout(500);

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    const hasDialog = await dialog.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDialog) {
      const nameField = dialog.locator('input[formcontrolname="name"], input[placeholder*="Name"], mat-form-field:has-text("Name") input').first();
      await nameField.clear();
      await nameField.fill('Updated Test Scenario Template');

      const saveButton = dialog.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.locator('text=Updated Test Scenario Template').first()).toBeVisible({ timeout: 10000 });
  });
});
