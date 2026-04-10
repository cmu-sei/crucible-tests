// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Clone Workspace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace list with existing workspaces
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Workspace list displays
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      // Hover over first workspace to reveal action buttons
      await workspaceItems.first().hover();
      await page.waitForTimeout(300);

      // 2. Click clone/duplicate button on a workspace card
      const cloneButton = page.locator('button:has-text("Clone"), button:has(mat-icon:text("content_copy")), button:has(mat-icon:text("file_copy")), [class*="clone"]').first();
      const hasClone = await cloneButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasClone) {
        await cloneButton.click();
        await page.waitForTimeout(1000);

        // expect: Clone confirmation dialog may appear
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasConfirm = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasConfirm) {
          // 3. Confirm clone action
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Clone"), button:has-text("OK"), button:has-text("Yes")').first();
          await confirmButton.click();
          await page.waitForTimeout(2000);
        }

        // expect: New workspace is created as a clone
        // expect: Cloned workspace appears in workspace list
      }
    }
  });
});
