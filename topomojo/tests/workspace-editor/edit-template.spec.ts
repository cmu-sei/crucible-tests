// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Edit Template', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor templates tab with existing templates
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
      const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template")').first();
      const templateItems = page.locator('mat-expansion-panel, [class*="template-item"], [class*="vm-item"]');
      await workspaceItems.first().click();
      await expect(page).toHaveURL(/\/topo\//);

      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await templatesTab.click();
        await expect(templateItems.first()).toBeVisible();
      }

      // expect: Templates list displays
      const templateCount = await templateItems.count();

      if (templateCount > 0) {
        // 2. Click edit button on a template
        const templateForm = page.locator('input, select, mat-select, textarea').first();
        await templateItems.first().click();
        await expect(templateForm).toBeVisible({ timeout: 5000 });

        // expect: Template editor opens
        // expect: Template configuration form is displayed with current settings
        await expect(templateForm).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
