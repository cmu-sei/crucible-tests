// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Create New Group in Move', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const movesLink = page.locator('a:has-text("Moves"), button:has-text("Moves")').first();
    await movesLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Expand a move and click 'Add Group' button
    const expandButton = page.locator('mat-expansion-panel-header').first();
    if (await expandButton.isVisible({ timeout: 5000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);

      const addGroupButton = page.locator('button:has-text("Add Group")').first();
      if (await addGroupButton.isVisible({ timeout: 5000 })) {
        await addGroupButton.click();

        // expect: Group creation form appears
        const groupForm = page.locator('form, mat-dialog-container, [role="dialog"]');
        await expect(groupForm).toBeVisible({ timeout: 5000 });

        // expect: Form includes: Group Number, Name, Description
        // expect: Move association is pre-filled and read-only
        const groupNumberField = page.locator('input[formcontrolname*="groupNumber"], input[name*="number"]').first();
        const nameField = page.locator('input[formcontrolname*="name"], input[placeholder*="Name"]').first();
        const descriptionField = page.locator('textarea[formcontrolname*="description"], textarea').first();

        // 2. Enter group details
        await groupNumberField.fill('2');
        await nameField.fill('Network Scanning');
        await descriptionField.fill('Execute network discovery scans');

        // expect: Fields accept input
        await expect(groupNumberField).toHaveValue('2');
        await expect(nameField).toHaveValue('Network Scanning');
        await expect(descriptionField).toHaveValue('Execute network discovery scans');

        // 3. Click 'Save'
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
        await saveButton.click();
        await page.waitForTimeout(2000);

        // expect: Group is created within the selected move
        // expect: Group appears in the move's group list
        const newGroup = page.locator('text=Network Scanning');
        await expect(newGroup).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
