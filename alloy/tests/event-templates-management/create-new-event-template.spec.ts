// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { deleteEventTemplateByName, deleteEventTemplatesByPattern, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  // Track the template name created in this test for cleanup
  let createdTemplateName: string | null = null;

  test.afterEach(async ({ page }) => {
    // Clean up the specific template created in this test
    if (createdTemplateName) {
      await deleteEventTemplateByName(page, createdTemplateName);
      createdTemplateName = null;
    }

    // Also clean up any templates matching the pattern (in case of test failure before rename)
    await deleteEventTemplatesByPattern(page, 'Test Exercise Template');
    // Clean up orphaned "New Event Template" rows left if the test failed mid-way
    await deleteDefaultEventTemplates(page);
  });

  test('Create New Event Template', async ({ page }) => {
    const uniqueName = `Test Exercise Template ${Date.now()}`;
    createdTemplateName = uniqueName;

    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Click 'Add Event Template' button and capture the API response to get the new template's ID.
    //    This avoids race conditions with parallel tests that may also create "New Event Template" rows.
    const [createResponse] = await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'POST' &&
        resp.status() >= 200 && resp.status() < 300
      ),
      page.getByRole('button', { name: 'Add Event Template' }).click(),
    ]);
    const created = await createResponse.json();
    const createdId: string = created.id;

    // 3. Open the edit dialog for the freshly created template using its unique ID.
    //    Each row has a "Copy: <id>" button. We locate our row by ID to avoid
    //    race conditions with parallel tests that also create "New Event Template" rows.
    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    const copyButton = page.getByRole('button', { name: `Copy: ${createdId}` });
    await expect(copyButton).toBeVisible({ timeout: 10000 });
    const rowCell = copyButton.locator('..');
    const editButton = rowCell.getByRole('button', { name: /^Edit:/ });
    await editButton.click();
    await expect(editDialog).toBeVisible();

    // 4. Enter unique name in the Name field — do this immediately to claim the template
    const nameField = page.getByRole('textbox', { name: /^Name/ });
    await nameField.fill(uniqueName);
    await expect(nameField).toHaveValue(uniqueName);

    // 5. Enter description in the Description field
    const descriptionField = page.getByRole('textbox', { name: /Description/ });
    await descriptionField.fill('This is a test exercise for validation');
    await expect(descriptionField).toHaveValue('This is a test exercise for validation');

    // 6. Set Duration Hours to '4'
    const durationField = page.getByRole('spinbutton', { name: 'Duration Hours' });
    await durationField.click();
    await durationField.fill('4');
    await expect(durationField).toHaveValue('4');

    // 7. Click 'Save' and wait for the API to confirm the update
    const [saveResponse] = await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'PUT' &&
        resp.status() >= 200 && resp.status() < 300
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ]);

    // expect: The dialog closes and the template appears in the list
    await expect(editDialog).not.toBeVisible();

    // The API confirmed the save (saveResponse). Verify the template is in the list.
    // With parallel tests, SignalR updates may cause the table to re-render.
    // Use the search box to filter to our specific template for reliable verification.
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(uniqueName);
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible({ timeout: 15000 });
    await searchBox.fill('');
  });
});
