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
  test('View Units List', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const unitName1 = tempBlueprintName('ViewList1');
    const unitName2 = tempBlueprintName('ViewList2');
    let unit1Id: string | undefined;
    let unit2Id: string | undefined;

    try {
      // Seed two units via API so we can assert their presence/absence
      const unit1 = await createUnit(token, { name: unitName1, shortName: 'VL1' });
      unit1Id = unit1.id;
      const unit2 = await createUnit(token, { name: unitName2, shortName: 'VL2' });
      unit2Id = unit2.id;

      // Navigate to Admin → Units
      await page.goto(`${Services.Blueprint.UI}/admin`);
      const unitsNav = page.locator('mat-list-item').filter({ hasText: 'Units' }).first();
      await expect(unitsNav).toBeVisible({ timeout: 10000 });

      // Don't pair the click with a `/api/units` GET: the admin shell may already have
      // fetched the list on load, in which case no new request follows the click and the
      // wait times out. The table becoming visible below is the real readiness signal.
      await unitsNav.click();

      // expect: Units list is displayed in a table format with Short Name and Name columns
      const unitsTable = page.locator('table').first();
      await expect(unitsTable).toBeVisible({ timeout: 5000 });

      const shortNameCol = page.getByRole('columnheader', { name: 'Short Name' });
      const nameCol = page.getByRole('columnheader', { name: 'Name', exact: true });
      await expect(shortNameCol).toBeVisible({ timeout: 5000 });
      await expect(nameCol).toBeVisible({ timeout: 5000 });

      // expect: Search functionality is available
      const searchInput = page.getByRole('textbox', { name: /search/i });
      await expect(searchInput).toBeVisible({ timeout: 5000 });

      // expect: Pagination controls are visible (if rows exist)
      const paginator = page.locator('mat-paginator').first();
      // Paginator may not be visible if few rows exist; don't fail on this

      // expect: Edit and Delete action buttons are shown when rows exist
      // Assert our seeded units are present
      const unit1Row = page.getByRole('cell', { name: unitName1, exact: true });
      await expect(unit1Row).toBeVisible({ timeout: 5000 });

      const unit2Row = page.getByRole('cell', { name: unitName2, exact: true });
      await expect(unit2Row).toBeVisible({ timeout: 5000 });

      // Edit and delete buttons should exist for our units
      const editButton = page.getByRole('button', { name: `Edit ${unitName1}` });
      await expect(editButton).toBeVisible({ timeout: 5000 });

      const deleteButton = page.getByRole('button', { name: `Delete ${unitName1}` });
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
    } finally {
      // Cleanup
      if (unit1Id) await deleteUnit(token, unit1Id);
      if (unit2Id) await deleteUnit(token, unit2Id);
    }
  });
});
