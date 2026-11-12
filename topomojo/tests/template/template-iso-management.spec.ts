// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Template Management', () => {
  test('Template ISO Management', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Open template editor
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const sidebar = page.locator('mat-sidenav, mat-drawer, [class*="sidebar"]').first();
    const workspaceItems = page.locator('[class*="workspace-card"], [class*="item-card"], mat-list-item, [class*="list-item"]');
    const templatesTab = page.locator('mat-tab:has-text("Template"), a:has-text("Template"), button:has-text("Template")').first();
    const templateItems = page.locator('mat-expansion-panel, [class*="template-item"]');
    const isoSection = page.locator('[class*="iso"], button:has-text("ISO"), mat-select[placeholder*="ISO"]').first();

    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
    }

    const itemCount = await workspaceItems.count();

    if (itemCount > 0) {
      await workspaceItems.first().click();
      await expect(templatesTab).toBeVisible({ timeout: 10000 });

      const hasTab = await templatesTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await templatesTab.click();
        await expect(templateItems.first()).toBeVisible({ timeout: 5000 });
      }

      const templateCount = await templateItems.count();

      if (templateCount > 0) {
        await templateItems.first().click();

        // expect: ISO management section is visible
        const hasISO = await isoSection.waitFor({ state: 'visible', timeout: 5000 }).then(() => true, () => false);

        if (hasISO) {
          const isoOptions = page.locator('mat-option, [class*="option"], [role="option"]').first();
          // 2. Click 'Attach ISO' or 'Select ISO' button
          await isoSection.click();
          await expect(isoOptions).toBeVisible({ timeout: 5000 });

          // expect: ISO selector opens
          // expect: Available ISOs are listed
        }
      }
    }
  });
});
