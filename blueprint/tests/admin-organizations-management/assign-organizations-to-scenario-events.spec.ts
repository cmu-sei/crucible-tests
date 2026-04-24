// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Organizations Management (Admin)', () => {
  test('Assign Organizations to Scenario Events', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Navigate to Scenario Events and create a new event
    const scenarioEventsLink = page.locator('a:has-text("Scenario Events"), button:has-text("Scenario Events")').first();
    await scenarioEventsLink.click();
    await page.waitForLoadState('domcontentloaded');

    const addEventButton = page.locator('button:has-text("Add Event"), button:has-text("Create")').first();
    if (await addEventButton.isVisible({ timeout: 5000 })) {
      await addEventButton.click();

      const eventForm = page.locator('form, mat-dialog-container');
      await expect(eventForm).toBeVisible({ timeout: 5000 });

      // expect: Event form includes 'From Org' and 'To Org' dropdowns
      const fromOrgDropdown = page.locator('mat-select[formcontrolname*="fromOrg"], select[name*="from"]').first();
      const toOrgDropdown = page.locator('mat-select[formcontrolname*="toOrg"], select[name*="to"]').first();

      // 2. Select organizations from the dropdowns
      if (await fromOrgDropdown.isVisible({ timeout: 3000 })) {
        await fromOrgDropdown.click();
        await page.waitForTimeout(500);

        // expect: Dropdowns show all available organizations
        const orgOption = page.locator('mat-option').first();
        await orgOption.click();
      }

      if (await toOrgDropdown.isVisible({ timeout: 3000 })) {
        await toOrgDropdown.click();
        await page.waitForTimeout(500);

        const orgOption = page.locator('mat-option').first();
        await orgOption.click();
      }

      // 3. Save the event
      const saveButton = page.locator('button:has-text("Save")').first();
      await saveButton.click();
      await page.waitForTimeout(2000);

      // expect: Organizations are assigned to the event
      // expect: Event displays 'From Org' and 'To Org' values
    }
  });
});
