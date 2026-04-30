// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dialog Enhancements', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up - dialog is cancelled without saving
  });

  test('Scenario Template Add Dialog Has Title', async ({ steamfitterAuthenticatedPage: page }) => {
    // Navigate to admin and select Scenario Templates
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    await expect(sidebar).toBeVisible({ timeout: 15000 });
    await sidebar.locator('text=Scenario Templates').first().click();
    await page.waitForTimeout(1000);

    // Click the Add button to open the add template dialog
    const addButton = page.getByRole('button', { name: /Add Scenario Template/i });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();
    await page.waitForTimeout(500);

    // Verify the dialog has the title 'Add Scenario Template'
    const dialog = page.locator('mat-dialog-container, [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const dialogTitle = page.locator('mat-dialog-container h1, mat-dialog-container h2, mat-dialog-container [mat-dialog-title], [role="dialog"] h1, [role="dialog"] h2').first();
    await expect(dialogTitle).toContainText(/Add Scenario Template/i, { timeout: 5000 });

    // Cancel the dialog
    const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
  });
});
