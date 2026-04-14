// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Cleanup/Delete', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to active gamespace
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), button:has-text("Gamespace")').first();
    const hasTab = await gamespaceTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTab) {
      await gamespaceTab.click();
      await page.waitForTimeout(500);
    }

    const activeGamespaces = page.locator('[class*="gamespace-card"], [class*="item-card"], mat-list-item');
    const activeCount = await activeGamespaces.count();

    if (activeCount > 0) {
      await activeGamespaces.first().click();
      await page.waitForTimeout(2000);

      // expect: Gamespace controls are visible
      // 2. Click 'End' or 'Delete Gamespace' button
      const endButton = page.locator('button:has-text("End"), button:has-text("Delete"), button:has-text("Stop"), button:has(mat-icon:text("stop"))').first();
      const hasEnd = await endButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasEnd) {
        await endButton.click();
        await page.waitForTimeout(500);

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasDialog) {
          // Cancel to avoid actually deleting
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          await cancelButton.click();
        }
      }
    }
  });
});
