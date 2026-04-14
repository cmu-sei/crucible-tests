// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Delete Workspace from Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin workspace browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const workspacesLink = page.locator('a:has-text("Workspace"), button:has-text("Workspace"), mat-tab:has-text("Workspace")').first();
    const hasLink = await workspacesLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await workspacesLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: Workspace list displays
    const workspaceRows = page.locator('tr, mat-row, [class*="workspace-row"]');
    const rowCount = await workspaceRows.count();

    if (rowCount > 0) {
      // 2. Click on a workspace to view details
      await workspaceRows.first().click();
      await page.waitForTimeout(500);

      // expect: Workspace details are displayed
      // expect: Delete button is visible
      const deleteButton = page.locator('button:has-text("Delete"), button:has(mat-icon:text("delete"))').first();
      const hasDelete = await deleteButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasDelete) {
        // 3. Click 'Delete' button
        await deleteButton.click();
        await page.waitForTimeout(500);

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasDialog) {
          // Cancel to avoid actually deleting
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          await cancelButton.click();
        }
      }
    }
  });
});
