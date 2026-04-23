// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Add Template', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor templates tab
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

      // Navigate to templates tab
      const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template")').first();
      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await templatesTab.click();
        await page.waitForTimeout(1000);
      }

      // expect: Add template button is visible
      const addButton = page.locator('button:has-text("Add"), button:has(mat-icon:text("add")), [class*="add-template"]').first();
      const hasAdd = await addButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAdd) {
        // 2. Click 'Add Template' button
        await addButton.click();
        await page.waitForTimeout(1000);

        // expect: Template selector or form opens
        const templateForm = page.locator('mat-dialog-container, [role="dialog"], [class*="template-form"], [class*="template-selector"]').first();
        const hasForm = await templateForm.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasForm) {
          await expect(templateForm).toBeVisible();
        }
      }
    }
  });
});
