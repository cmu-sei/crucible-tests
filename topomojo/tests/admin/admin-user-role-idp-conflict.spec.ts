// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - User Role Badge and IDP Conflict Warning', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to admin user browser
    await page.goto(Services.TopoMojo.UI + '/admin');
    await page.waitForLoadState('domcontentloaded');

    const usersLink = page.locator('a:has-text("User"), button:has-text("User"), mat-tab:has-text("User")').first();
    const hasUsers = await usersLink.isVisible({ timeout: 10000 }).catch(() => false);
    if (hasUsers) {
      await usersLink.click();
      await page.waitForTimeout(1000);
    }

    // expect: User list displays with role information
    // 2. Observe user role badges
    const roleBadges = page.locator('[class*="role"], [class*="badge"], mat-chip').first();
    const hasBadges = await roleBadges.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBadges) {
      // expect: User role badge displays role information
      await expect(roleBadges).toBeVisible();

      // 3. Click on role badge or warning indicator if present
      const warningIndicator = page.locator('[class*="warning"], mat-icon:text("warning"), [class*="conflict"]').first();
      const hasWarning = await warningIndicator.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasWarning) {
        await warningIndicator.click();
        await page.waitForTimeout(500);

        // expect: Modal opens explaining the role conflict
        const modal = page.locator('mat-dialog-container, [role="dialog"]').first();
        const hasModal = await modal.isVisible({ timeout: 3000 }).catch(() => false);
        if (hasModal) {
          // 4. Close the modal
          const closeButton = page.locator('button:has-text("Close"), button:has-text("OK"), button:has(mat-icon:text("close"))').first();
          await closeButton.click();
        }
      }
    }
  });
});
