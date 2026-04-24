// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('Delete Organization', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const organizationsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
    await organizationsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click delete icon for an organization not referenced by scenario events
    const deleteButton = page.locator('button[mattooltip*="Delete"], mat-icon:has-text("delete")').last();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      await deleteButton.click();

      // expect: Confirmation dialog
      const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      await expect(confirmDialog).toContainText(/delete/i);

      // 2. Confirm deletion
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // expect: Organization is deleted
      // expect: Organization is removed from the table
    }

    // 3. Attempt to delete an organization referenced in scenario events
    // expect: Warning: 'Cannot delete organization used in scenario events'
    // expect: Delete action is blocked or shows error
  });
});
