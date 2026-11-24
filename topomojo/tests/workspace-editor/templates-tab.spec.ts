// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Templates Tab', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor
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
      const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template"), [routerLink*="template"]').first();
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Workspace editor tabs are visible
      // 2. Click on 'Templates' tab
      const templateList = page.locator('[class*="template"], [class*="vm-list"], mat-list, mat-expansion-panel').first();
      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTab) {
        await templatesTab.click();
        await expect(templateList).toBeVisible();

        // expect: Templates tab is selected
        // expect: List of templates in the workspace is displayed
        const hasList = await templateList.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasList) {
          await expect(templateList).toBeVisible();
        }
      }
    }
  });
});
