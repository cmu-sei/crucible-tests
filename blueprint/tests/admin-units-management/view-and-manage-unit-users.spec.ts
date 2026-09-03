// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createUnit,
  deleteUnit,
  tempBlueprintName,
} from '../../test-helpers';

test.describe('Admin - Units Management', () => {
  test('View and Manage Unit Users', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const unitName = tempBlueprintName('ViewUsers');
    const shortName = 'VU';
    let unitId: string | undefined;

    try {
      // Seed a unit via API
      const unit = await createUnit(token, { name: unitName, shortName });
      unitId = unit.id;

      // Navigate to Admin → Units
      await page.goto(`${Services.Blueprint.UI}/admin`);
      const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
      await expect(unitsNav).toBeVisible({ timeout: 10000 });
      await unitsNav.click();

      // Wait for the table to be visible
      const unitsTable = page.locator('table').first();
      await expect(unitsTable).toBeVisible({ timeout: 5000 });

      // Click on the unit row to expand it
      const unitRow = page.getByRole('row').filter({ hasText: unitName }).first();
      await expect(unitRow).toBeVisible({ timeout: 5000 });
      await unitRow.click();

      // expect: Row expands, showing the app-admin-unit-users component
      const expandedDetail = page.locator('app-admin-unit-users').first();
      await expect(expandedDetail).toBeVisible({ timeout: 5000 });

      // expect: "Unit Members" panel is visible
      const unitMembersPanel = expandedDetail.getByText('Unit Members');
      await expect(unitMembersPanel).toBeVisible({ timeout: 5000 });

      // expect: "Users" panel (all users list for adding) is visible
      const usersPanel = expandedDetail.getByText('Users');
      await expect(usersPanel).toBeVisible({ timeout: 5000 });

      // expect: Admin can manage — add-user buttons are present and enabled
      const addUserButton = expandedDetail.locator('button[title^="Add "]').first();
      await expect(addUserButton).toBeVisible({ timeout: 5000 });
      await expect(addUserButton).toBeEnabled();

      // Click on the row again to collapse it
      await unitRow.click();

      // expect: Expanded detail is no longer visible
      await expect(expandedDetail).not.toBeVisible({ timeout: 3000 });
    } finally {
      // Cleanup via API
      if (unitId) {
        await deleteUnit(token, unitId);
      }
    }
  });
});
