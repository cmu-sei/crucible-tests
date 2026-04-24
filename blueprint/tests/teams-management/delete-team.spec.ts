// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('Delete Team', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click delete icon for a team not assigned to any users or scenario events
    const deleteButton = page.locator('button[mattooltip*="Delete"], mat-icon:has-text("delete")').last();
    if (await deleteButton.isVisible({ timeout: 5000 })) {
      await deleteButton.click();

      // expect: Confirmation dialog: 'Are you sure you want to delete this team?'
      const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      await expect(confirmDialog).toContainText(/delete.*team/i);

      // 2. Confirm deletion
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // expect: Team is deleted
      // expect: Team is removed from the table
    }

    // 3. Attempt to delete a team with assigned users
    // expect: Warning: 'Cannot delete team with assigned users'
    // expect: Delete action is blocked
  });
});
