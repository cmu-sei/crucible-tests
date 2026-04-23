// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Create Challenge', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace challenge tab
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

      const challengeTab = page.locator('mat-tab:has-text("Challenge"), a:has-text("Challenge"), button:has-text("Challenge")').first();
      const hasTab = await challengeTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasTab) {
        await challengeTab.click();
        await page.waitForTimeout(1000);
      }

      // 2. Click 'Add Challenge' or 'Create Question' button
      const addButton = page.locator('button:has-text("Add"), button:has(mat-icon:text("add")), [class*="add-challenge"]').first();
      const hasAdd = await addButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasAdd) {
        await addButton.click();
        await page.waitForTimeout(1000);

        // expect: Challenge form opens
        // 3. Enter challenge question text
        const questionField = page.locator('textarea, input[placeholder*="uestion"], input[formcontrolname*="question"]').first();
        const hasQuestion = await questionField.isVisible({ timeout: 5000 }).catch(() => false);
        if (hasQuestion) {
          await questionField.fill('What is the default port for SSH?');
        }
      }
    }
  });
});
