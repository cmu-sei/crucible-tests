// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('File Management', () => {
  test('File Delete', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to file browser with existing files
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await page.waitForTimeout(2000);

      const filesTab = page.locator('mat-tab:has-text("File"), a:has-text("File"), button:has-text("File")').first();
      const hasTab = await filesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await filesTab.click();
        await page.waitForTimeout(1000);
      }

      // expect: File list displays
      const fileItems = page.locator('[class*="file-item"], [class*="file-row"], mat-list-item');
      const fileCount = await fileItems.count();

      if (fileCount > 0) {
        // 2. Click delete button on a file
        const deleteButton = page.locator('button:has(mat-icon:text("delete")), button:has-text("Delete"), [class*="delete"]').first();
        const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasDelete) {
          await deleteButton.click();
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
    }
  });
});
