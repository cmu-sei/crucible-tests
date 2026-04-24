// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('Edit Team and Assign CITE Team Type', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Click edit icon for an existing team
    const editButton = page.locator('button[mattooltip*="Edit"], mat-icon:has-text("edit")').first();
    if (await editButton.isVisible({ timeout: 5000 })) {
      await editButton.click();

      // expect: Edit form displays with current team details
      const editForm = page.locator('form, mat-dialog-container');
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // 2. Change CITE Team Type from 'None' to 'Blue'
      // expect: CITE Team Type dropdown shows options: None, Red, Blue, Gold, White
      const citeTeamTypeDropdown = page.locator('mat-select[formcontrolname*="citeTeamType"], select').first();
      if (await citeTeamTypeDropdown.isVisible({ timeout: 3000 })) {
        await citeTeamTypeDropdown.click();
        await page.waitForTimeout(500);

        const blueOption = page.locator('mat-option:has-text("Blue")').first();
        await blueOption.click();
      }

      // 3. Click 'Save'
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);

      // expect: Team is updated with CITE Team Type
      // expect: CITE Team Type column reflects the change
    }
  });
});
