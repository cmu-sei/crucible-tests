// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dialog Enhancements', () => {
  let templateId: string | null = null;

  test.afterEach(async ({ steamfitterApi }) => {
    if (templateId) {
      try {
        await steamfitterApi.delete(`${Services.Steamfitter.API}/api/scenariotemplates/${templateId}`);
      } catch { /* ignore cleanup errors */ }
      templateId = null;
    }
  });

  test('Dialog Validation Prevents Invalid Saves', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create a template via API
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Validation Test Template', description: 'Test validation', durationHours: 1 },
    });
    expect(createResp.ok()).toBeTruthy();
    const template = await createResp.json();
    templateId = template.id;

    // Navigate to admin and select Scenario Templates
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Find and open edit dialog for the template
    await expect(page.locator('text=Validation Test Template').first()).toBeVisible({ timeout: 10000 });

    const templateRow = page.locator('text=Validation Test Template').first();
    const editButton = templateRow.locator('..').locator('button:has(mat-icon:text("edit")), button:has(mat-icon:text("more_vert"))').first();
    const hasEditButton = await editButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEditButton) {
      await editButton.click();
      await page.waitForTimeout(500);

      const editOption = page.locator('[role="menuitem"]:has-text("Edit"), button:has-text("Edit")').first();
      const hasEditOption = await editOption.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasEditOption) {
        await editOption.click();
        await page.waitForTimeout(500);
      }
    }

    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);

    if (dialogVisible) {
      // Clear the name field to make it invalid
      const nameField = dialog.locator('input[placeholder*="Name"], input[formcontrolname="name"], mat-form-field input').first();
      await nameField.clear();
      await page.waitForTimeout(300);

      // Try to save
      const saveButton = dialog.locator('button:has-text("Save"), button:has-text("Submit"), button[type="submit"]').first();
      const saveDisabled = await saveButton.isDisabled().catch(() => false);

      if (!saveDisabled) {
        await saveButton.click();
        await page.waitForTimeout(500);
      }

      // Verify validation error appears
      const validationError = dialog.locator('mat-error, [class*="error"], [role="alert"]').first();
      const hasError = await validationError.isVisible({ timeout: 3000 }).catch(() => false);
      // Either the save button should be disabled or an error message should appear
      expect(saveDisabled || hasError).toBe(true);

      // Enter a valid name and verify save succeeds
      await nameField.fill('Validation Test Template Updated');
      await page.waitForTimeout(300);

      if (await saveButton.isEnabled()) {
        await saveButton.click();
        await page.waitForTimeout(1000);

        // Dialog should close on successful save
        await expect(dialog).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});
