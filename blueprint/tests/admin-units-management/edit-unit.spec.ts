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
  test('Edit Unit', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const originalName = tempBlueprintName('EditUnit');
    const updatedName = tempBlueprintName('EditedUnit');
    const shortName = 'ETU';
    let unitId: string | undefined;

    try {
      // Seed a unit via API
      const unit = await createUnit(token, { name: originalName, shortName });
      unitId = unit.id;

      // Navigate to Admin → Units
      await page.goto(`${Services.Blueprint.UI}/admin`);
      const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
      await expect(unitsNav).toBeVisible({ timeout: 10000 });
      await unitsNav.click();

      // Wait for the table to be visible
      const unitsTable = page.locator('table').first();
      await expect(unitsTable).toBeVisible({ timeout: 5000 });

      // Verify the unit appears in the table
      const unitCell = page.getByRole('cell', { name: originalName, exact: true }).first();
      await expect(unitCell).toBeVisible({ timeout: 5000 });

      // Click edit button for the unit
      const editButton = page.getByRole('button', { name: `Edit ${originalName}` });
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // expect: Edit form appears
      const editForm = page.locator('[role="dialog"]').first();
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // Modify the Name field
      const editNameField = page.getByRole('dialog').first().getByRole('textbox', { name: 'Name', exact: true });
      await expect(editNameField).toBeVisible({ timeout: 5000 });
      await editNameField.clear();
      await editNameField.fill(updatedName);

      // Click 'Save', waiting for PUT response
      const updateResponse = page.waitForResponse(
        (resp) => resp.url().includes(`/api/units/${unitId}`) && resp.request().method() === 'PUT'
      );
      const editSaveButton = page.locator('button:has-text("Save")').first();
      await editSaveButton.click();
      await updateResponse;

      // expect: Changes are reflected in the table
      const updatedCell = page.getByRole('cell', { name: updatedName, exact: true }).first();
      await expect(updatedCell).toBeVisible({ timeout: 5000 });

      // Verify server-side persistence
      const checkResp = await fetch(`${Services.Blueprint.API}/api/units/${unitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(checkResp.ok).toBe(true);
      const persisted = await checkResp.json();
      expect(persisted.name).toBe(updatedName);
    } finally {
      // Cleanup via API
      if (unitId) {
        await deleteUnit(token, unitId);
      }
    }
  });
});
