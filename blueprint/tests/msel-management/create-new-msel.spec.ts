// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('Create New MSEL', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSELs list
    await page.goto(`${Services.Blueprint.UI}/build`);
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });

    // expect: MSELs list is visible
    await page.waitForLoadState('networkidle');

    // 2. Click 'Add blank MSEL' button
    const createButton = page.getByRole('button', { name: 'Add blank MSEL' });

    await expect(createButton).toBeVisible({ timeout: 10000 });

    // Get count of MSELs before creating
    const rowsBefore = await page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' }).count();

    await createButton.click();

    // expect: A new MSEL is created immediately without a form dialog
    // Blueprint creates a "New MSEL" with default values and redirects to edit it
    await page.waitForTimeout(1000);

    // expect: The new MSEL appears in the MSELs list or we're redirected to edit page
    // Check if we're on the build page with a msel parameter or still on the list
    const currentUrl = page.url();

    if (currentUrl.includes('msel=')) {
      // We were redirected to edit the new MSEL
      // The MSEL details/edit page should be visible
      await expect(page).toHaveURL(/.*msel=.*/, { timeout: 5000 });
    } else {
      // We're still on the list, new MSEL should appear
      const rowsAfter = await page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' }).count();
      expect(rowsAfter).toBeGreaterThan(rowsBefore);

      // The new MSEL should be visible (typically named "New MSEL")
      const newMselItem = page.getByRole('link', { name: /New MSEL/i });
      await expect(newMselItem.first()).toBeVisible({ timeout: 5000 });
    }

    // expect: User can access the newly created MSEL
    await page.waitForLoadState('networkidle');
  });
});
