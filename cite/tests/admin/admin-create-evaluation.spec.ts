// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, apiDeleteEvaluationsByName, Services, loadCiteSeedIds, SHARED_SCORING_MODEL, settleForResponse, CITE_THEMES, setCiteTheme } from '../../fixtures';
import { navigateToAdminSection, waitForDialogOpen, findAdminRowByName } from '../../test-helpers';

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Administration - Evaluations`, () => {
    test.beforeEach(async () => {
      // The run-level shared scoring model fills the Scoring Model dropdown; creating an
      // evaluation only copies it.
      await loadCiteSeedIds();
    });

    test('Create Evaluation', async ({ citeAuthenticatedPage: page }) => {
      await setCiteTheme(page, theme);

      // 1. Navigate to admin evaluations section
      await navigateToAdminSection(page, 'Evaluations');

      // expect: Evaluations section is displayed
      // expect: Create button (Add Evaluation) is visible
      const createButton = page.getByRole('button', { name: 'Add Evaluation' });
      await expect(createButton).toBeVisible({ timeout: 10000 });

      // 2. Click 'Add Evaluation' button
      await createButton.click();

      // expect: Create evaluation dialog/form opens
      const dialog = page.getByRole('dialog', { name: 'Add Evaluation' });
      await waitForDialogOpen(dialog);

      // 3. Enter evaluation description
      const descriptionField = page.getByRole('textbox', { name: 'Evaluation Description' });
      await descriptionField.fill('Test Evaluation Automation');

      // expect: Description field accepts input
      await expect(descriptionField).toHaveValue('Test Evaluation Automation');

      // 4. Wait for scoring models to load and select the shared one
      const scoringModelSelect = page.getByRole('combobox', { name: 'Scoring Model' });
      await expect(scoringModelSelect).toBeVisible({ timeout: 5000 });

      // Wait for scoring models API to load
      await settleForResponse(page, '/api/scoringmodels');

      // Click the dropdown to open options
      await scoringModelSelect.click();
      // Rule applied: removed fixed sleep

      // Select the shared scoring model by its exact name: the first option is often another
      // spec's model (or an evaluation's copy, "<model> => on <evaluation>"), which may be
      // deleted while this one runs.
      const firstOption = page.locator('mat-option').filter({ hasText: new RegExp(`^\\s*${SHARED_SCORING_MODEL}\\s*$`) }).first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      const optionText = await firstOption.textContent();
      await firstOption.click();

      // Verify the scoring model was selected
      await expect(scoringModelSelect).toContainText(optionText || '', { timeout: 5000 });

      // 5. Click 'Save' button
      const saveButton = page.getByRole('button', { name: 'Save' });
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      await saveButton.click();

      // expect: Dialog closes after save
      await expect(dialog).not.toBeVisible({ timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');

      // Rule D: wait for row to appear so cleanup can find it (use findAdminRowByName for paginated list)
      const newEvalRow = await findAdminRowByName(page, 'Test Evaluation Automation');
      await expect(newEvalRow).toBeVisible({ timeout: 10000 });
    });

    test.afterEach(async () => {
      // Cleanup: Delete test evaluations
      await apiDeleteEvaluationsByName('Test Evaluation Automation');
    });
  });
}
