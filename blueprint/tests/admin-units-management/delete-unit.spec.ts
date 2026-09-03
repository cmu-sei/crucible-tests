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
  test('Delete Unit', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const unitName = tempBlueprintName('DeleteUnit');
    const shortName = 'DTU';
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

      // Verify the unit was seeded and appears in the table
      const unitCell = page.getByRole('cell', { name: unitName, exact: true }).first();
      await expect(unitCell).toBeVisible({ timeout: 5000 });

      // Click delete button for the unit
      const deleteButton = page.getByRole('button', { name: `Delete ${unitName}` });
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
      await deleteButton.click();

      // expect: Confirmation dialog appears
      const confirmDialog = page.locator('[role="dialog"]').first();
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      // Confirm the deletion, waiting for the DELETE API call
      const deleteResponse = page.waitForResponse(
        (resp) => resp.url().includes(`/api/units/${unitId}`) && resp.request().method() === 'DELETE'
      );
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")').last();
      await confirmButton.click();
      await deleteResponse;

      // expect: Unit is deleted successfully and removed from table
      await expect(unitCell).not.toBeVisible({ timeout: 5000 });

      // Verify server-side deletion
      const checkResp = await fetch(`${Services.Blueprint.API}/api/units/${unitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(checkResp.status).toBe(404);

      // Clear unitId so afterEach doesn't try to delete it again
      unitId = undefined;
    } finally {
      // Cleanup: delete the unit if it still exists (e.g., test failed before UI delete)
      if (unitId) {
        await deleteUnit(token, unitId);
      }
    }
  });
});
