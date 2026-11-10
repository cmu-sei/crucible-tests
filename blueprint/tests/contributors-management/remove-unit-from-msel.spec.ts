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
    test('Remove Unit from MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    await applyBlueprintTheme(page, theme);
      const token = await getBlueprintToken();
      const mselName = tempBlueprintName('RemoveUnit');
      const unitName = tempBlueprintName('RemoveTestUnit');
      const unitShortName = 'RTU';

      // 1. Seed a MSEL and a Unit via API
      const createdMsel = await createMsel(token, {
        name: mselName,
        description: 'Test MSEL for unit removal',
      });

      const createdUnit = await createUnit(token, { name: unitName, shortName: unitShortName });

      // 2. Add the unit to the MSEL via API
      const mselUnit = await addUnitToMsel(token, createdMsel.id, createdUnit.id);

      try {
        // 3. Navigate to the MSEL's Contributors section
        await navigateToMselSection(page, createdMsel.id, 'Contributors');

        // expect: Contributors section is visible
        await expect(page.locator('mat-list-item').filter({ hasText: 'Contributors' })).toBeVisible();

        // 4. Verify the unit appears in the contributors table
        const unitCell = page.locator('[role="cell"], td').filter({ hasText: unitShortName });
        await expect(unitCell).toBeVisible({ timeout: 10000 });

        // 5. Click the remove button for the unit
        const removeBtn = page.locator('button[title="Remove unit from MSEL"]').first();
        await expect(removeBtn).toBeVisible();
        await removeBtn.click();

        // 6. Confirm the removal dialog
        const confirmDialog = page.locator('[role="dialog"]').first();
        await expect(confirmDialog).toBeVisible({ timeout: 10000 });

        const yesBtn = confirmDialog.getByRole('button', { name: 'YES' });
        await expect(yesBtn).toBeVisible();
        await yesBtn.click();

        // 7. Verify the unit is no longer in the contributors table
        await expect(
          page.locator('[role="cell"], td').filter({ hasText: unitShortName })
        ).not.toBeVisible({ timeout: 10000 });
      } finally {
        // 8. Clean up: delete the mselUnit (if not already removed), MSEL, and unit
        // Try to remove via API in case the UI removal failed
        await removeUnitFromMsel(token, mselUnit.id);
        await deleteMsel(token, createdMsel.id);
        await deleteUnit(token, createdUnit.id);
      }
    });
    });
}