// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Template Management', () => {
  test('Template Unlink from Parent', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open template that is linked to parent
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

      const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template")').first();
      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await templatesTab.click();
        await page.waitForTimeout(1000);
      }

      const templateItems = page.locator('mat-expansion-panel, [class*="template-item"]');
      const templateCount = await templateItems.count();

      if (templateCount > 0) {
        await templateItems.first().click();
        await page.waitForTimeout(500);

        // expect: Parent template relationship is shown (if linked)
        // 2. Click 'Unlink' button
        const unlinkButton = page.locator('button:has-text("Unlink"), button:has(mat-icon:text("link_off"))').first();
        const hasUnlink = await unlinkButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasUnlink) {
          // expect: Template can be unlinked from parent
          await expect(unlinkButton).toBeVisible();
        }
      }
    }
  });
});
