// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Model For Edit';

  test('Edit Scoring Model', async ({ citeAuthenticatedPage: page }) => {

    // Create a test scoring model first
    await navigateToAdminSection(page, 'Scoring Models');

    const addButton = page.getByRole('button', { name: 'Add Scoring Model' });
    await addButton.click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible({ timeout: 5000 });

    const descField = page.getByRole('textbox', { name: 'Scoring Model Description' });
    await descField.fill(TEST_MODEL_NAME);

    const saveButton = createDialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(createDialog).not.toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Re-navigate to refresh the list
    await navigateToAdminSection(page, 'Scoring Models');

    // Now edit it
    const modelRow = page.locator('tbody tr').filter({ hasText: TEST_MODEL_NAME }).first();
    await expect(modelRow).toBeVisible({ timeout: 10000 });

    const editButton = modelRow.getByRole('button', { name: /^Edit / });
    await editButton.click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    const editDescField = editDialog.getByRole('textbox', { name: 'Scoring Model Description' });
    await expect(editDescField).toBeVisible({ timeout: 5000 });
    const currentValue = await editDescField.inputValue();
    expect(currentValue).toContain(TEST_MODEL_NAME);

    // Close the dialog so cleanup can access the table
    const cancelButton = editDialog.getByRole('button', { name: 'Cancel' }).last();
    await cancelButton.click();
    await expect(editDialog).not.toBeVisible({ timeout: 5000 });
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
