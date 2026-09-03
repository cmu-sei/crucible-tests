// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  tempBlueprintName,
  findMselRowByName,
} from '../../test-helpers';

test.describe('MSEL Management', () => {
  test('Clone MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    const token = await getBlueprintToken();
    const mselName = tempBlueprintName('Clone-Source');

    // 1. Seed a MSEL to clone via API
    const createdMsel = await createMsel(token, {
      name: mselName,
      description: 'Test MSEL for cloning',
    });

    let clonedMselId: string | null = null;

    try {
      // 2. Navigate to MSELs list
      await page.goto(`${Services.Blueprint.UI}/build`);
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

      // 3. Find the seeded MSEL using the search box
      const mselRow = await findMselRowByName(page, mselName);
      await expect(mselRow).toBeVisible();

      // 4. Click the Copy button in the row
      const cloneButton = mselRow.getByRole('button', { name: /Copy/i });
      await expect(cloneButton).toBeVisible();
      await cloneButton.click();

      // 5. Confirm the copy dialog
      const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: 'Copy MSEL' });
      await expect(confirmDialog).toBeVisible({ timeout: 10000 });
      const yesButton = confirmDialog.getByRole('button', { name: 'Yes' });
      await expect(yesButton).toBeVisible();
      await yesButton.click();

      // 6. Wait for the clone operation to complete by detecting the new row
      // The cloned MSEL typically gets a name like "OriginalName - Admin User"
      const clonedMselName = `${mselName} - Admin User`;

      // Use the search box to find the cloned MSEL
      const clonedRow = await findMselRowByName(page, clonedMselName);
      await expect(clonedRow).toBeVisible({ timeout: 15000 });

      // 7. Extract the cloned MSEL's ID from its link for cleanup
      const clonedLink = clonedRow.locator('a[href*="msel="]').first();
      const href = await clonedLink.getAttribute('href');
      const match = href?.match(/msel=([a-f0-9-]+)/);
      if (match) {
        clonedMselId = match[1];
      }

      // expect: Clone succeeded and the cloned MSEL is visible
      await expect(clonedRow).toBeVisible();
    } finally {
      // 8. Clean up: delete both the original and the cloned MSEL
      await deleteMsel(token, createdMsel.id);
      if (clonedMselId) {
        await deleteMsel(token, clonedMselId);
      }
    }
  });
});
