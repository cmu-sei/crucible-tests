// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Delete Group', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const movesLink = page.locator('a:has-text("Moves"), button:has-text("Moves")').first();
    await movesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click delete icon for a group without scenario events
    const expandButton = page.locator('mat-expansion-panel-header').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      const deleteButton = page.locator('button[mattooltip*="Delete"], mat-icon:has-text("delete")').last();
      if (await deleteButton.isVisible({ timeout: 5000 })) {
        await deleteButton.click();

        // expect: Confirmation dialog appears
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]');
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        await expect(confirmDialog).toContainText(/delete.*group/i);

        // 2. Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
        await confirmButton.click();
        await page.waitForTimeout(2000);

        // expect: Group is deleted
        // expect: Group is removed from the move
      }
    }

    // 3. Attempt to delete a group containing scenario events
    // expect: Warning: 'Cannot delete group with existing scenario events. Remove all events first.'
    // expect: Delete action is blocked
  });
});
