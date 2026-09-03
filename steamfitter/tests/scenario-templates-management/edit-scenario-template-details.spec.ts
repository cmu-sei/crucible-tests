// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedScenarioTemplate, deleteScenarioTemplatesByPrefix } from '../../fixtures';
import {
  navigateToHomeSection,
  findHomeRowByText,
  openRowContextMenu,
  clickContextMenuItem,
  fillScenarioTemplateDialog,
} from '../../test-helpers';

test.describe('Scenario Templates Management', () => {
  const ORIGINAL_NAME = `E2E Edit Template ${Date.now()}`;
  const UPDATED_NAME = `E2E Edit Template Updated ${Date.now()}`;
  const UPDATED_DESCRIPTION = 'Description updated by an automated end-to-end test.';

  // Seed the template to edit via the API — the edit path is what's under test, not
  // creation.
  test.beforeEach(async () => {
    await seedScenarioTemplate(ORIGINAL_NAME, 'Template to be edited', 1);
  });

  // Both names carry the E2E prefix; delete either one the test may have left behind.
  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Edit Template']);
  });

  test('Edit scenario template details', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section and locate the seeded row.
    await navigateToHomeSection(page, 'Scenario Templates');
    const row = await findHomeRowByText(page, ORIGINAL_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });

    // 2. Open the row's context menu and choose Edit.
    await openRowContextMenu(page, row, 'Scenario Template Menu');
    await clickContextMenuItem(page, 'Edit');

    // expect: The Edit dialog opens pre-populated; the title reads "Edit Scenario
    // Template".
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Edit Scenario Template')).toBeVisible({ timeout: 5000 });

    // 3. Change name + description and Save. The helper waits on the PUT.
    await fillScenarioTemplateDialog(page, {
      name: UPDATED_NAME,
      description: UPDATED_DESCRIPTION,
    });

    // expect: The updated row is findable by its new name and shows the new
    // description; the old name no longer matches a row.
    const updatedRow = await findHomeRowByText(page, UPDATED_NAME);
    await expect(updatedRow).toBeVisible({ timeout: 10000 });
    await expect(updatedRow).toContainText(UPDATED_DESCRIPTION);

    await expect(
      page.locator('tbody tr.element-row').filter({ hasText: ORIGINAL_NAME })
    ).toHaveCount(0);
  });
});
