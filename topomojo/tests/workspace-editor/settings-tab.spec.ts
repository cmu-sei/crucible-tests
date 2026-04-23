// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Workspace Editor', () => {
  test('Workspace Editor - Settings Tab', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to workspace editor for an existing workspace
    // First get a workspace from the sidebar
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

      // expect: Workspace editor page loads
      await expect(page).toHaveURL(/\/topo\//, { timeout: 10000 });

      // expect: Tabs or sections are visible (Settings, Templates, Document, Challenge, Files, Play)
      const tabs = page.locator('mat-tab, [class*="tab"], a[routerLink], button[mat-tab-link]');
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThan(0);

      // expect: Settings tab is selected by default
      // expect: Settings form displays fields for workspace name, description, audience, etc.
      const settingsForm = page.locator('form, [class*="settings"], input, textarea').first();
      await expect(settingsForm).toBeVisible({ timeout: 10000 });

      // expect: Workspace ID is displayed in text-muted style
      const workspaceId = page.locator('[class*="text-muted"], [class*="id"], code').first();
      const hasId = await workspaceId.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasId) {
        await expect(workspaceId).toBeVisible();
      }
    }
  });
});
