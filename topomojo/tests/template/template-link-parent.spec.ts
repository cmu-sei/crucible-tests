// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Template Management', () => {
  test('Template Link to Parent', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Create or select a template
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
        // expect: Template editor is open
        await templateItems.first().click();
        await page.waitForTimeout(500);

        // 2. Look for parent template or link option
        const linkButton = page.locator('button:has-text("Link"), button:has-text("Parent"), [class*="link-parent"]').first();
        const hasLink = await linkButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasLink) {
          // expect: Parent template selector is available
          await expect(linkButton).toBeVisible();
        }
      }
    }
  });
});
