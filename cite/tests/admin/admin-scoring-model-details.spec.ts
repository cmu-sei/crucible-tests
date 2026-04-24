// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Model For Details';

  test('Expand Scoring Model Details', async ({ citeAuthenticatedPage: page }) => {

    // 1. Create a scoring model
    await navigateToAdminSection(page, 'Scoring Models');

    const addButton = page.getByRole('button', { name: 'Add Scoring Model' });
    await addButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    const descField = page.getByRole('textbox', { name: 'Scoring Model Description' });
    await descField.fill(TEST_MODEL_NAME);

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // 2. Re-navigate and find the scoring model
    await navigateToAdminSection(page, 'Scoring Models');

    const modelRow = page.locator('tbody tr').filter({ hasText: TEST_MODEL_NAME }).first();
    await expect(modelRow).toBeVisible({ timeout: 10000 });

    // 3. Click the row to expand details
    await modelRow.click();
    await page.waitForTimeout(2000);

    // 4. Verify expanded detail content is visible (scoring categories, options, etc.)
    const expandedContent = page.locator('mat-expansion-panel, .detail-row, [class*="expanded"]').first();
    await expect(expandedContent).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
