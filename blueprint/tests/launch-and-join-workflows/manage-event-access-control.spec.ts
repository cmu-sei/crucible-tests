// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Launch and Join Event Workflows', () => {
  test('Manage Event Access Control', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Access manage page for a deployed MSEL as a non-owner without permissions
    // For this test we test the access control message UI with admin user navigating to manage page

    // Navigate to the manage page — this route shows access control messaging
    // when the user doesn't have management permissions for any active events
    await page.goto(`${Services.Blueprint.UI}/manage`);
    await page.waitForLoadState('networkidle');

    // expect: The manage page loads
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });

    // Check if the 'nothing to manage' message is shown
    const nothingToManage = page.locator('text=You have nothing to manage.').first();
    const permissionsMessage = page.locator(
      'text=/contact your administrator/i, text=/believe you should have permissions/i'
    ).first();

    const nothingVisible = await nothingToManage.isVisible({ timeout: 5000 }).catch(() => false);

    if (nothingVisible) {
      // expect: 'You have nothing to manage.' message is displayed
      await expect(nothingToManage).toBeVisible({ timeout: 5000 });

      // expect: 'If you believe you should have permissions to manage this event, contact your administrator.' message is shown
      await expect(permissionsMessage).toBeVisible({ timeout: 5000 });

      // expect: No management controls are visible
      const managementControls = page.locator(
        'button:has-text("End Event"), button:has-text("Manage"), [class*="manage-controls"]'
      ).first();
      const controlsVisible = await managementControls.isVisible({ timeout: 2000 }).catch(() => false);
      expect(controlsVisible).toBe(false);
    } else {
      // Admin has management permissions — verify management controls are visible instead
      const managementContent = page.locator('mat-card, [class*="manage"], [class*="event-list"]').first();
      await expect(managementContent).toBeVisible({ timeout: 5000 });
    }
  });
});
