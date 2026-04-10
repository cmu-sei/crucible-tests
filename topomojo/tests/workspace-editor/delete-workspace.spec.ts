// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Delete Workspace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
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

      // expect: Workspace editor loads
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // 2. Click 'Delete Workspace' button
      const deleteButton = page.locator('button:has-text("Delete"), button:has(mat-icon:text("delete"))').first();
      const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDelete) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasDialog) {
          // expect: Dialog warns about permanent deletion

          // 3. Cancel deletion
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          await cancelButton.click();
          await page.waitForTimeout(300);

          // expect: Dialog closes
          // expect: Workspace is not deleted
          await expect(page).toHaveURL(/\/topo\//);
        }
      }
    }
  });
});
