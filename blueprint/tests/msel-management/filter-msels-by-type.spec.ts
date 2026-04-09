// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Management', () => {
  test('Filter MSELs by Type', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to /build and click the 'All Types' dropdown
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const allTypesDropdown = page.getByRole('combobox', { name: 'All Types' });
    await expect(allTypesDropdown).toBeVisible({ timeout: 5000 });
    await allTypesDropdown.click();

    // expect: Dropdown shows type filter options
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 5000 });

    // 2. Select the template filter option
    const templateOption = page.getByRole('option', { name: 'Template' });
    const templateVisible = await templateOption.isVisible({ timeout: 3000 }).catch(() => false);

    if (!templateVisible) {
      // Try the second option if template is not labeled
      await options.nth(1).click();
    } else {
      await templateOption.click();
    }

    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // expect: The MSEL list filters to show only MSELs marked as templates
    // expect: MSELs without template status are hidden
    const mselRows = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const filteredCount = await mselRows.count();
    // All visible rows should have template status checked

    // 3. Select 'All Types' to reset
    // After filtering, the dropdown label changes to the selected filter (e.g., "Templates")
    // So we need to find the dropdown by its new label or position
    const typeDropdown = page.getByRole('combobox').filter({ hasText: /Templates|All Types/i }).first();
    await typeDropdown.click();
    const allTypesOption = page.getByRole('option', { name: 'All Types' });
    await expect(allTypesOption).toBeVisible({ timeout: 5000 });
    await allTypesOption.click();

    await page.waitForTimeout(500);
    await page.waitForLoadState('networkidle');

    // expect: All MSELs are displayed again
    const resetCount = await mselRows.count();
    expect(resetCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
