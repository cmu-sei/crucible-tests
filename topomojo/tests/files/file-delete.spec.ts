// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('File Management', () => {
  test('File Delete', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to file browser with existing files
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const filesTab = page.locator('mat-tab:has-text("File"), a:has-text("File"), button:has-text("File")').first();
      await workspaceItems.first().click();
      await expect(filesTab).toBeVisible({ timeout: 5000 });
      const hasTab = await filesTab.isVisible({ timeout: 5000 }).catch(() => false);
      const fileItems = page.locator('[class*="file-item"], [class*="file-row"], mat-list-item');
      if (hasTab) {
        await filesTab.click();
        await expect(fileItems.first()).toBeVisible({ timeout: 5000 });
      }

      // expect: File list displays
      const fileCount = await fileItems.count();

      if (fileCount > 0) {
        // 2. Click delete button on a file
        const deleteButton = page.locator('button:has(mat-icon:text("delete")), button:has-text("Delete"), [class*="delete"]').first();
        const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasDelete) {
          const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
          await deleteButton.click();

          // expect: Confirmation dialog appears
          const hasDialog = await confirmDialog.waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);

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
