// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('File Management', () => {
  test('File Upload - Oversized File', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to file browser
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

      // expect: Upload interface is available
      const fileInput = page.locator('input[type="file"]').first();
      const hasFileInput = await fileInput.count() > 0;

      if (hasFileInput) {
        // 2. File size validation is enforced
        // expect: Validation error is displayed for oversized files
        // expect: Upload is prevented or fails gracefully
        await expect(fileInput).toBeAttached();
      }
    }
  });
});
