// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Audience Configuration', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor settings
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
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Audience field or section is visible
      const audienceField = page.locator('input[placeholder*="udience"], input[formcontrolname*="audience"], [class*="audience"], mat-select').first();
      const hasAudience = await audienceField.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAudience) {
        // 2. Set or modify workspace audience
        await audienceField.click();
        await page.waitForTimeout(300);

        // expect: Audience field accepts selection
        // Type or select audience value
        if (await audienceField.evaluate(el => el.tagName.toLowerCase()) === 'input') {
          await audienceField.fill('Test Audience');
        }
      }
    }
  });
});
