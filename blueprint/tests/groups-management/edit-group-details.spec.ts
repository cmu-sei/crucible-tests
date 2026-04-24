// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Edit Group Details', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const movesLink = page.locator('a:has-text("Moves"), button:has-text("Moves")').first();
    await movesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Expand a move and click edit icon for a group
    const expandButton = page.locator('mat-expansion-panel-header').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      const editButton = page.locator('button[mattooltip*="Edit"], mat-icon:has-text("edit")').first();
      if (await editButton.isVisible({ timeout: 5000 })) {
        await editButton.click();

        // expect: Edit form displays with current group details
        const editForm = page.locator('form, mat-dialog-container');
        await expect(editForm).toBeVisible({ timeout: 5000 });

        // 2. Modify the Name to 'Updated Group Name'
        const nameField = page.locator('input[formcontrolname*="name"], input[placeholder*="Name"]').first();
        await nameField.clear();
        await nameField.fill('Updated Group Name');

        // expect: Change is accepted
        await expect(nameField).toHaveValue('Updated Group Name');

        // 3. Click 'Save'
        const saveButton = page.locator('button:has-text("Save")').first();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // expect: Group is updated
        // expect: Updated name displays in the group list
        const updatedGroup = page.locator('text=Updated Group Name');
        await expect(updatedGroup).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
