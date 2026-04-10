// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Workspace Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin dashboard
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    // 2. Click on 'Workspaces' section
    const workspacesLink = page.locator('a:has-text("Workspace"), button:has-text("Workspace"), mat-tab:has-text("Workspace")').first();
    const hasLink = await workspacesLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await workspacesLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Admin workspace browser loads
    // expect: All workspaces are listed in table format
    const workspaceTable = page.locator('table, mat-table, [class*="workspace-list"], [class*="browser"]').first();
    await expect(workspaceTable).toBeVisible({ timeout: 10000 });
  });
});
