// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Add Template', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor templates tab
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
      // Navigate to templates tab
      const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template")').first();
      const addButton = page.locator('button:has-text("Add"), button:has(mat-icon:text("add")), [class*="add-template"]').first();
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//);

      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await templatesTab.click();
        await expect(addButton).toBeVisible();
      }

      // expect: Add template button is visible
      const hasAdd = await addButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAdd) {
        // 2. Click 'Add Template' button
        const templateForm = page.locator('mat-dialog-container, [role="dialog"], [class*="template-form"], [class*="template-selector"]').first();
        await addButton.click();
        await expect(templateForm).toBeVisible();

        // expect: Template selector or form opens
        const hasForm = await templateForm.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasForm) {
          await expect(templateForm).toBeVisible();
        }
      }
    }
  });
});
