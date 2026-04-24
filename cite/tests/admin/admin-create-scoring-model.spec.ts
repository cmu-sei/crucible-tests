// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, deleteScoringModelByName } from '../../test-helpers';

test.describe('Administration - Scoring Models', () => {

  const TEST_MODEL_NAME = 'Test Scoring Model Automation';

  test('Create Scoring Model', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Scoring Models');

    const addButton = page.getByRole('button', { name: 'Add Scoring Model' });
    await expect(addButton).toBeVisible({ timeout: 10000 });
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
  });

  test.afterEach(async ({ citeAuthenticatedPage: page }) => {
    await deleteScoringModelByName(page, TEST_MODEL_NAME);
  });
});
