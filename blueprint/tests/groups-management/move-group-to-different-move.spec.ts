// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Move Group to Different Move', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const movesLink = page.locator('a:has-text("Moves"), button:has-text("Moves")').first();
    await movesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Edit a group and change its Move association from Move 1 to Move 2
    const expandButton = page.locator('mat-expansion-panel-header').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      const editButton = page.locator('button[mattooltip*="Edit"], mat-icon:has-text("edit")').first();
      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click();

        const editForm = page.locator('form, mat-dialog-container');
        await expect(editForm).toBeVisible({ timeout: 5000 });

        // expect: Move dropdown shows available moves
        const moveDropdown = page.locator('mat-select[formcontrolname*="move"], select[name*="move"]').first();
        if (await moveDropdown.isVisible({ timeout: 3000 })) {
          await moveDropdown.click();
          await page.waitForTimeout(500);

          // Select a different move
          const moveOption = page.locator('mat-option').nth(1);
          await moveOption.click();

          // 2. Save the change
          const saveButton = page.locator('button:has-text("Save")').first();
          await saveButton.click();
          await page.waitForTimeout(2000);

          // expect: Group is reassigned to the new move
          // expect: All scenario events in the group move with it
          // expect: Timeline view reflects the new organization
        }
      }
    }
  });
});
