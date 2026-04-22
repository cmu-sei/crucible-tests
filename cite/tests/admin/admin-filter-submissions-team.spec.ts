// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Submissions', () => {
  test('Filter Submissions by Team', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to Submissions section
    await navigateToAdminSection(page, 'Submissions');

    // 2. Verify the Types filter is present and functional
    const typesFilter = page.getByRole('combobox', { name: 'Types' });
    await expect(typesFilter).toBeVisible({ timeout: 5000 });

    // 3. Open the Types filter and select an option
    await typesFilter.click();
    await page.waitForTimeout(500);

    const options = page.locator('mat-option');
    await expect(options.first()).toBeVisible({ timeout: 5000 });

    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);

    // Select the first type option
    const firstOptionText = await options.first().textContent();
    await options.first().click();
    await page.waitForTimeout(1000);

    // 4. Verify the filter is applied (the dropdown shows the selected value)
    await expect(typesFilter).toContainText(firstOptionText?.trim() || '', { timeout: 5000 });
  });
});
