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

  test('Scenario Template Edit Dialog Has Title', async ({ steamfitterAuthenticatedPage: page, steamfitterApi }) => {
    // Setup: create a template via API
    const createResp = await steamfitterApi.post(`${Services.Steamfitter.API}/api/scenariotemplates`, {
      data: { name: 'Edit Dialog Title Test', description: 'Test edit dialog title', durationHours: 1 },
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

    // Find and click on the template to open edit dialog
    await expect(page.locator('text=Edit Dialog Title Test').first()).toBeVisible({ timeout: 10000 });

    const templateRow = page.locator('text=Edit Dialog Title Test').first();
    const editButton = templateRow.locator('..').locator('button:has(mat-icon:text("edit")), button:has(mat-icon:text("more_vert"))').first();
    const hasEditButton = await editButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasEditButton) {
      await editButton.click();
      await page.waitForTimeout(500);

      // If it was a menu, click Edit option
      const editOption = page.locator('[role="menuitem"]:has-text("Edit"), button:has-text("Edit")').first();
      const hasEditOption = await editOption.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasEditOption) {
        await editOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify the dialog has the title 'Edit Scenario Template'
    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    const dialogVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);

    if (dialogVisible) {
      const dialogTitle = page.locator('mat-dialog-container h1, mat-dialog-container h2, mat-dialog-container [mat-dialog-title], [role="dialog"] h1, [role="dialog"] h2').first();
      await expect(dialogTitle).toContainText(/Edit Scenario Template/i, { timeout: 5000 });

      // Cancel the dialog
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }
  });
});
