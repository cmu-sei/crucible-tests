// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, BLUEPRINT_THEMES, applyBlueprintTheme } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  navigateToMselSection,
  createUnit,
  deleteUnit,
  addUnitToMsel,
  removeUnitFromMsel,
} from '../../test-helpers';

for (const theme of BLUEPRINT_THEMES) {
    test.describe(`${theme} theme › Contributors Management`, () => {
    test('Add Unit to MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const mselName = tempBlueprintName('UnitTest');
      const unitName = tempBlueprintName('TestUnit');
      const unitShortName = 'TU';

      // 1. Seed a MSEL and a Unit via API
      const createdMsel = await createMsel(token, {
        name: mselName,
        description: 'Test MSEL for unit addition',
      });

      const createdUnit = await createUnit(token, { name: unitName, shortName: unitShortName });

      let mselUnitId: string | null = null;

      try {
        // 2. Add the unit to the MSEL via API
        const mselUnit = await addUnitToMsel(token, createdMsel.id, createdUnit.id);
        mselUnitId = mselUnit.id;

        // 3. Navigate to the MSEL's Contributors section
        await navigateToMselSection(page, createdMsel.id, 'Contributors');

        // expect: Contributors section is visible
        await expect(page.locator('mat-list-item').filter({ hasText: 'Contributors' })).toBeVisible();

        // 4. Verify the unit appears in the contributors table
        // The contributors table shows units with their short name
        const unitCell = page.locator('[role="cell"], td').filter({ hasText: unitShortName }).first();
        await expect(unitCell).toBeVisible({ timeout: 10000 });
      } finally {
        // 5. Clean up: delete the mselUnit, MSEL, and unit
        if (mselUnitId) {
          await removeUnitFromMsel(token, mselUnitId);
        }
        await deleteMsel(token, createdMsel.id);
        await deleteUnit(token, createdUnit.id);
      }
    });
    });
}