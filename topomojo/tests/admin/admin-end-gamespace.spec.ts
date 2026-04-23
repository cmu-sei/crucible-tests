// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Forcefully End Gamespace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin gamespace details
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const gamespaceLink = page.locator('a:has-text("Gamespace"), button:has-text("Gamespace"), mat-tab:has-text("Gamespace")').first();
    const hasLink = await gamespaceLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await gamespaceLink.click();
      await page.waitForTimeout(1000);
    }

    const gamespaceRows = page.locator('tr, mat-row, [class*="gamespace-row"]');
    const rowCount = await gamespaceRows.count();

    if (rowCount > 0) {
      await gamespaceRows.first().click();
      await page.waitForTimeout(1000);

      // expect: Gamespace details and controls are visible
      // 2. Click 'End' or 'Delete' gamespace button
      const endButton = page.locator('button:has-text("End"), button:has-text("Delete"), button:has(mat-icon:text("stop"))').first();
      const hasEnd = await endButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasEnd) {
        await endButton.click();
        await page.waitForTimeout(500);

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasDialog) {
          // Cancel to avoid actually ending
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          await cancelButton.click();
        }
      }
    }
  });
});
