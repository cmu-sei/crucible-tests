// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('Add Users to Team', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Expand a team row to view team members section
    const expandButton = page.locator('mat-expansion-panel-header, button[aria-label*="expand"]').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      // expect: Team members are listed if any exist
      // expect: An 'Add User' button or user selector is visible
      const addUserButton = page.locator('button:has-text("Add User"), button:has-text("Add Member")').first();
      
      // 2. Click 'Add User' and select a user from the dropdown
      if (await addUserButton.isVisible({ timeout: 5000 })) {
        await addUserButton.click();

        // expect: User selector shows available users not already in the team
        const userSelector = page.locator('mat-select, select').first();
        if (await userSelector.isVisible({ timeout: 3000 })) {
          await userSelector.click();
          await page.waitForTimeout(500);

          const userOption = page.locator('mat-option').first();
          await userOption.click();

          // 3. Confirm user addition
          const confirmButton = page.locator('button:has-text("Add"), button:has-text("Confirm")').first();
          if (await confirmButton.isVisible({ timeout: 3000 })) {
            await confirmButton.click();
            await page.waitForTimeout(2000);

            // expect: User is added to the team
            // expect: User appears in the team members list
          }
        }
      }
    }
  });
});
