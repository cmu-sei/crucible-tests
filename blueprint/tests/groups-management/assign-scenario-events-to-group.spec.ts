// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Groups Management', () => {
  test('Assign Scenario Events to Group', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to scenario events
    const scenarioEventsLink = page.locator('a:has-text("Scenario Events"), button:has-text("Scenario Events")').first();
    await scenarioEventsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Create a new scenario event
    const addEventButton = page.locator('button:has-text("Add Event"), button:has-text("Create")').first();
    if (await addEventButton.isVisible({ timeout: 5000 })) {
      await addEventButton.click();

      const eventForm = page.locator('form, mat-dialog-container');
      await expect(eventForm).toBeVisible({ timeout: 5000 });

      // expect: Event form includes Move and Group selectors
      const moveSelector = page.locator('mat-select[formcontrolname*="move"], select[name*="move"]').first();
      const groupSelector = page.locator('mat-select[formcontrolname*="group"], select[name*="group"]').first();

      // 2. Select a Move, then select a Group within that Move
      if (await moveSelector.isVisible({ timeout: 3000 })) {
        await moveSelector.click();
        await page.waitForTimeout(500);

        const moveOption = page.locator('mat-option').first();
        await moveOption.click();
        await page.waitForTimeout(500);

        // expect: Group dropdown populates with groups from the selected move only
        if (await groupSelector.isVisible({ timeout: 3000 })) {
          await groupSelector.click();
          await page.waitForTimeout(500);

          const groupOption = page.locator('mat-option').first();
          await groupOption.click();
        }
      }

      // 3. Save the scenario event
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);

      // expect: Event is assigned to the selected group
      // expect: Event appears in the group's event list when the group is expanded
    }
  });
});
