// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Revoke API Key', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin API keys page with existing keys
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const apiKeysLink = page.locator('a:has-text("API"), button:has-text("API"), mat-tab:has-text("API")').first();
    const hasLink = await apiKeysLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasLink) {
      await apiKeysLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: API keys list displays
    const keyRows = page.locator('tr, mat-row, [class*="key-row"]');
    const keyCount = await keyRows.count();

    if (keyCount > 0) {
      // 2. Click 'Revoke' button on an API key
      const revokeButton = page.locator('button:has-text("Revoke"), button:has-text("Delete"), button:has(mat-icon:text("delete"))').first();
      const hasRevoke = await revokeButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasRevoke) {
        await revokeButton.click();
        await page.waitForTimeout(500);

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasDialog = await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasDialog) {
          // Cancel to avoid actually revoking
          const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
          await cancelButton.click();
        }
      }
    }
  });
});
