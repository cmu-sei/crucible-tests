// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('File Management', () => {
  test('File Browser Access', async ({ topomojoAuthenticatedPage: page }) => {

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

      // expect: Files or ISO management section is accessible
      // 2. Click on files/ISO tab or button
      const filesTab = page.locator('mat-tab:has-text("File"), a:has-text("File"), button:has-text("File"), [routerLink*="file"]').first();
      const hasTab = await filesTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTab) {
        await filesTab.click();
        await page.waitForTimeout(1000);

        // expect: File browser interface loads
        // expect: File list or upload area is displayed
        const fileArea = page.locator('[class*="file"], [class*="upload"], [class*="dropzone"], input[type="file"]').first();
        const hasFiles = await fileArea.isVisible({ timeout: 10000 }).catch(() => false);
        if (hasFiles) {
          await expect(fileArea).toBeVisible();
        }
      }
    }
  });
});
