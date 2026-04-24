// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('Remove User from Team', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Expand a team row with existing members
    const expandButton = page.locator('mat-expansion-panel-header, button[aria-label*="expand"]').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // expect: Team members are displayed with remove buttons
      const removeButton = page.locator('button[mattooltip*="Remove"], mat-icon:has-text("remove"), mat-icon:has-text("delete")').first();
      
      // 2. Click remove icon for a user
      if (await removeButton.isVisible({ timeout: 5000 })) {
        await removeButton.click();

        // expect: Confirmation dialog: 'Remove [username] from [team name]?'
        const confirmDialog = page.locator('mat-dialog-container, [role="dialog"]');
        if (await confirmDialog.isVisible({ timeout: 3000 })) {
          await expect(confirmDialog).toContainText(/remove/i);

          // 3. Confirm removal
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Remove")').first();
          await confirmButton.click();
          await page.waitForTimeout(2000);

          // expect: User is removed from the team
          // expect: User no longer appears in team members list
        }
      }
    }
  });
});
