// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { deleteScenarioTemplatesByPrefix } from '../../fixtures';
import { navigateToHomeSection, findHomeRowByText } from '../../test-helpers';

test.describe('Scenario Templates Management', () => {
  // Unique per run so parallel/retried runs never collide, and the name-prefix
  // cleanup below only ever removes rows this suite created.
  const TEMPLATE_NAME = `E2E Scenario Template ${Date.now()}`;
  const TEMPLATE_DESCRIPTION = 'Created by an automated end-to-end smoke test.';
  const TEMPLATE_DURATION = '2';

  // Backstop cleanup via the API: removes the row regardless of how the UI portion
  // ended (a failed assertion could leave the template behind). Idempotent — a no-op
  // when the test already deleted its own data or never created any.
  test.afterEach(async () => {
    await deleteScenarioTemplatesByPrefix(['E2E Scenario Template']);
  });

  test('Create a new scenario template', async ({ steamfitterAuthenticatedPage: page }) => {
    // 1. Open the Scenario Templates section on the home page
    await navigateToHomeSection(page, 'Scenario Templates');

    // 2. Click the "Add Scenario Template" button
    const addButton = page.locator('button[title="Add Scenario Template"]');
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // expect: The Add Scenario Template dialog opens (crucible-dialog renders as a
    // role="dialog" with the given title).
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByText('Add Scenario Template')).toBeVisible();

    // 3. Fill in Name, Description, and Duration Hours (all required, name/description
    // need 4+ chars, duration must be a positive integer).
    const nameField = dialog.getByRole('textbox', { name: /Name/ });
    await nameField.fill(TEMPLATE_NAME);
    await expect(nameField).toHaveValue(TEMPLATE_NAME);

    const descriptionField = dialog.getByRole('textbox', { name: /Description/ });
    await descriptionField.fill(TEMPLATE_DESCRIPTION);
    await expect(descriptionField).toHaveValue(TEMPLATE_DESCRIPTION);

    const durationField = dialog.getByRole('spinbutton', { name: /Duration Hours/ });
    await durationField.fill(TEMPLATE_DURATION);
    await expect(durationField).toHaveValue(TEMPLATE_DURATION);

    // 4. Save. The POST returns the created template; wait on it so the assertion
    // below runs against a persisted row rather than a race.
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/scenarioTemplates') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15000 }
    );

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();

    await createResponse.catch(() => {});

    // expect: The dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // expect: The new template appears in the list (filter by its unique name so it
    // is collapsed onto the first page).
    const row = await findHomeRowByText(page, TEMPLATE_NAME);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText(TEMPLATE_DESCRIPTION);
    await expect(row).toContainText(TEMPLATE_DURATION);
  });
});
