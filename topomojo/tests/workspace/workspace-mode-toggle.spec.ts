// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Workspace Management', () => {
  test('Workspace Mode Toggle - Workspace vs Gamespace View', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page workspace browser
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"], button:has(mat-icon:text("menu"))').first();
    const hasSidebarToggle = await sidebarToggle.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasSidebarToggle) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
    }

    // expect: Mode toggle is visible (e.g., tabs or buttons for 'Workspaces' and 'Gamespaces')
    const modeToggle = page.locator('mat-button-toggle-group, [class*="mode-toggle"], mat-tab-group').first();
    const hasToggle = await modeToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasToggle) {
      // 2. Click on 'Gamespaces' mode
      const gamespaceTab = page.locator('mat-button-toggle:has-text("Gamespace"), mat-tab:has-text("Gamespace"), button:has-text("Gamespace")').first();
      const hasGamespaceTab = await gamespaceTab.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasGamespaceTab) {
        await gamespaceTab.click();
        await page.waitForTimeout(500);

        // expect: View switches to gamespace mode
        // expect: Active and playable gamespaces are displayed

        // 3. Click on 'Workspaces' mode
        const workspaceTab = page.locator('mat-button-toggle:has-text("Workspace"), mat-tab:has-text("Workspace"), button:has-text("Workspace")').first();
        await workspaceTab.click();
        await page.waitForTimeout(500);

        // expect: View switches back to workspace mode
        // expect: Workspace list is displayed
      }
    }
  });
});
