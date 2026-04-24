// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('Create New Team', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Navigate to Teams section and click 'Add Team' button
    const addTeamButton = page.locator('button:has-text("Add Team")').first();
    await expect(addTeamButton).toBeVisible({ timeout: 10000 });
    await addTeamButton.click();

    // expect: Team creation form appears
    const teamForm = page.locator('form, mat-dialog-container, [role="dialog"]');
    await expect(teamForm).toBeVisible({ timeout: 5000 });

    // expect: Form includes: Name, Short Name, CITE Team Type dropdown
    const nameField = page.locator('input[formcontrolname*="name"], input[placeholder*="Name"]').first();
    const shortNameField = page.locator('input[formcontrolname*="shortName"], input[placeholder*="Short"]').first();
    const citeTeamTypeDropdown = page.locator('mat-select[formcontrolname*="citeTeamType"], select').first();

    // 2. Enter team details: Name 'Red Team', Short Name 'RED'
    await nameField.fill('Red Team');
    await shortNameField.fill('RED');

    // expect: Fields accept input
    await expect(nameField).toHaveValue('Red Team');
    await expect(shortNameField).toHaveValue('RED');

    // 3. Select 'Red' from CITE Team Type dropdown
    if (await citeTeamTypeDropdown.isVisible({ timeout: 3000 })) {
      await citeTeamTypeDropdown.click();
      await page.waitForTimeout(500);

      const redOption = page.locator('mat-option:has-text("Red")').first();
      await redOption.click();

      // expect: CITE Team Type is assigned
    }

    // 4. Click 'Save'
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Submit")').first();
    await saveButton.click();
    await page.waitForTimeout(2000);

    // expect: Team is created successfully
    // expect: Team appears in the teams table
    const newTeam = page.locator('text=Red Team');
    await expect(newTeam).toBeVisible({ timeout: 5000 });
  });
});
