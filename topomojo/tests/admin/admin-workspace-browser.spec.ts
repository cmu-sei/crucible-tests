// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Workspace Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // 2. Wait for Admin button to confirm authentication (fixture already authenticated)
    // The Admin button only appears after auth state is set - wait generously to avoid race conditions
    const adminButton = page.getByRole('button', { name: 'Admin' });

    try {
      await adminButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch (error) {
      throw new Error(`Admin button did not appear within 30 seconds. Current URL: ${page.url()}`);
    }

    // 3. Click on 'Admin' button in navigation
    await adminButton.click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // 4. Click on 'Workspaces' link in admin navigation
    const workspacesLink = page.getByRole('link', { name: 'Workspaces' });
    await workspacesLink.click();
    await page.waitForURL(/\/admin\/workspaces/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin workspace browser loads
    // expect: Workspace browser header row is visible (always present, even when empty)
    const workspaceHeader = page.locator('.workspace-header');
    await expect(workspaceHeader).toBeVisible({ timeout: 10000 });

    // expect: Workspace rows are visible if workspaces exist (graceful check for empty state)
    const workspaceRows = page.locator('.workspace-row');
    const rowCount = await workspaceRows.count();
    if (rowCount > 0) {
      await expect(workspaceRows.first()).toBeVisible();
    }
  });
});
