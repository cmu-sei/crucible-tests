// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Model For Categories';

  test('Manage Scoring Categories', async ({ citeAuthenticatedPage: page }) => {

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

    // 2. Re-navigate and expand the scoring model
    await navigateToAdminSection(page, 'Scoring Models');

    const modelRow = page.locator('tbody tr').filter({ hasText: TEST_MODEL_NAME }).first();
    await expect(modelRow).toBeVisible({ timeout: 10000 });
    await modelRow.click();
    await page.waitForTimeout(2000);

    // 3. Find and expand the Scoring Categories panel
    const categoriesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Scoring Categories' }).first();
    await expect(categoriesPanel).toBeVisible({ timeout: 10000 });
    await categoriesPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    // 4. Add a scoring category
    const addCategoryButton = categoriesPanel.locator('button[title="Add Scoring Category"]');
    await expect(addCategoryButton).toBeVisible({ timeout: 5000 });
    await addCategoryButton.click();

    const categoryDialog = page.getByRole('dialog');
    await expect(categoryDialog).toBeVisible({ timeout: 5000 });

    const categoryDescField = categoryDialog.locator('textarea').first();
    await categoryDescField.fill('Test Category Description');

    const categorySaveButton = categoryDialog.getByRole('button', { name: 'Save' });
    await expect(categorySaveButton).toBeEnabled({ timeout: 5000 });
    await categorySaveButton.click();
    await expect(categoryDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 5. Re-expand the panel if it collapsed after dialog close, then verify the category
    const panelHeader = categoriesPanel.locator('mat-expansion-panel-header').first();
    const isExpanded = await panelHeader.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await panelHeader.click();
      await page.waitForTimeout(1000);
    }

    const categoryItem = categoriesPanel.locator('text=Test Category Description').first();
    await categoryItem.scrollIntoViewIfNeeded();
    await expect(categoryItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
