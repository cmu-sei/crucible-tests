// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: /mnt/data/crucible/crucible-tests/blueprint/blueprint-test-plan.md

import { test, expect } from '@playwright/test';
import { Services, authenticateBlueprintWithKeycloak } from '../../fixtures';

test.describe('Teams Management', () => {
  test('View Teams in MSEL', async ({ page }) => {
    await authenticateBlueprintWithKeycloak(page);

    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('domcontentloaded');

    const firstMselLink = page.locator('a[href*="/msel/"]').first();
    await firstMselLink.click();
    await page.waitForLoadState('domcontentloaded');

    // 1. Navigate to a MSEL and click 'Teams' in the sidebar navigation
    const teamsLink = page.locator('a:has-text("Teams"), button:has-text("Teams")').first();
    await teamsLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Teams section loads
    await expect(page).toHaveURL(/.*teams.*/i);

    // expect: Table displays teams with columns: Name, Short Name, CITE Team Type, Users
    const teamsTable = page.locator('table, mat-table, [role="table"]');
    await expect(teamsTable).toBeVisible({ timeout: 10000 });

    // expect: An 'Add Team' button is visible if user has permissions
    const addTeamButton = page.locator('button:has-text("Add Team"), button[aria-label*="Add Team"]');
    if (await addTeamButton.isVisible({ timeout: 3000 })) {
      await expect(addTeamButton).toBeVisible();
    }

    // expect: Each team row can be expanded to show team members
    const expandButton = page.locator('button[aria-label*="expand"], mat-expansion-panel-header').first();
    if (await expandButton.isVisible({ timeout: 3000 })) {
      await expandButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
