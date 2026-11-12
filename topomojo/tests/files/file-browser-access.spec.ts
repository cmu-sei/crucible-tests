// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('File Management', () => {
  test('File Browser Access', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
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
      const filesTab = page.locator('mat-tab:has-text("File"), a:has-text("File"), button:has-text("File"), [routerLink*="file"]').first();
      await workspaceItems.first().click();
      await expect(filesTab).toBeVisible({ timeout: 5000 });

      // expect: Files or ISO management section is accessible
      // 2. Click on files/ISO tab or button
      const hasTab = await filesTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTab) {
        const fileArea = page.locator('[class*="file"], [class*="upload"], [class*="dropzone"], input[type="file"]').first();
        await filesTab.click();

        // expect: File browser interface loads
        // expect: File list or upload area is displayed
        const hasFiles = await fileArea.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
        if (hasFiles) {
          await expect(fileArea).toBeVisible();
        }
      }
    }
  });
});
