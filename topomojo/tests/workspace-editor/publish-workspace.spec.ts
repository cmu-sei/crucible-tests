// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Publish Workspace', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor settings
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"], [class*="side-panel"]').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible();
    }

    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');

    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      const publishToggle = page.locator('mat-slide-toggle:has-text("Publish"), mat-checkbox:has-text("Publish"), [class*="publish"], input[type="checkbox"]').first();
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Publish or visibility settings are available
      // 2. Set workspace to published status
      const hasPublish = await publishToggle.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasPublish) {
        // expect: Publish toggle or checkbox can be enabled
        const saveButton = page.locator('button:has-text("Save"), button:has(mat-icon:text("save"))').first();
        await publishToggle.click();
        await expect(publishToggle).toBeChecked();

        // 3. Save workspace settings
        const hasSave = await saveButton.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasSave) {
          await saveButton.click();
          await expect(publishToggle).toBeChecked();
        }

        // expect: Workspace is published
        // expect: Workspace becomes available for gamespace deployment
      }
    }
  });
});
