// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { deleteEventTemplatesByPattern, deleteDefaultEventTemplates } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  const DELETE_PREFIX = 'ToDelete';

  test.afterEach(async ({ page }) => {
    await deleteEventTemplatesByPattern(page, DELETE_PREFIX);
    // Clean up orphaned "New Event Template" rows left if the test failed mid-way
    await deleteDefaultEventTemplates(page);
  });

  test('Delete Event Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Create a new template and capture its ID from the API response
    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
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

    // 3. Open the freshly created template using its unique ID
    const copyButton = page.getByRole('button', { name: `Copy: ${createdId}` });
    await expect(copyButton).toBeVisible({ timeout: 10000 });
    const rowCell = copyButton.locator('..');
    await rowCell.getByRole('button', { name: /^Edit:/ }).click();
    await expect(editDialog).toBeVisible();

    // 4. Rename so afterEach can clean up if the delete fails
    const uniqueName = `${DELETE_PREFIX} ${Date.now()}`;
    await page.getByRole('textbox', { name: /^Name/ }).fill(uniqueName);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).not.toBeVisible();

    // 5. Re-open the template to delete it (use the copy button with the known ID)
    await expect(copyButton).toBeVisible({ timeout: 10000 });
    await rowCell.getByRole('button', { name: /^Edit:/ }).click();
    await expect(editDialog).toBeVisible();

    // 6. Click 'Delete' button within the edit dialog
    await editDialog.getByRole('button', { name: 'Delete' }).click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible();

    // 7. Confirm deletion by clicking 'Yes'
    await confirmDialog.getByRole('button', { name: 'Yes' }).click();

    // expect: Both dialogs close after deletion
    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).not.toBeVisible();

    // expect: The table is still visible
    await expect(page.getByRole('table')).toBeVisible();
  });
});
