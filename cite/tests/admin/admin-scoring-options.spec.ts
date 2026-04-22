// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Model For Options';

  test('Manage Scoring Options', async ({ citeAuthenticatedPage: page }) => {

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

    // 3. Expand Scoring Categories panel and add a category first
    const categoriesPanel = page.locator('mat-expansion-panel').filter({ hasText: 'Scoring Categories' }).first();
    await expect(categoriesPanel).toBeVisible({ timeout: 10000 });
    await categoriesPanel.locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(1000);

    const addCategoryButton = categoriesPanel.locator('button[title="Add Scoring Category"]');
    await addCategoryButton.click();

    const categoryDialog = page.getByRole('dialog');
    await expect(categoryDialog).toBeVisible({ timeout: 5000 });
    await categoryDialog.locator('textarea').first().fill('Category For Options Test');
    await categoryDialog.getByRole('button', { name: 'Save' }).click();
    await expect(categoryDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 4. Re-expand the categories panel if collapsed, then expand the new category
    const catPanelHeader = categoriesPanel.locator('mat-expansion-panel-header').first();
    const isCatExpanded = await catPanelHeader.getAttribute('aria-expanded');
    if (isCatExpanded !== 'true') {
      await catPanelHeader.click();
      await page.waitForTimeout(1000);
    }

    const categoryRow = categoriesPanel.locator('text=Category For Options Test').first();
    await categoryRow.scrollIntoViewIfNeeded();
    await expect(categoryRow).toBeVisible({ timeout: 10000 });
    await categoryRow.click();
    await page.waitForTimeout(1000);

    // 5. Add a scoring option
    const addOptionButton = page.locator('button[title="Add Scoring Option"]');
    await expect(addOptionButton).toBeVisible({ timeout: 5000 });
    await addOptionButton.click();

    const optionDialog = page.getByRole('dialog');
    await expect(optionDialog).toBeVisible({ timeout: 5000 });

    const optionDescField = optionDialog.locator('textarea').first();
    await optionDescField.fill('Test Scoring Option');

    const optionSaveButton = optionDialog.getByRole('button', { name: 'Save' });
    await expect(optionSaveButton).toBeEnabled({ timeout: 5000 });
    await optionSaveButton.click();
    await expect(optionDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 6. Verify the scoring option appears
    const optionItem = page.locator('text=Test Scoring Option');
    await expect(optionItem).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
