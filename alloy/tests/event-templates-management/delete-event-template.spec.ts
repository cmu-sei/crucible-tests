// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { deleteEventTemplatesByPattern } from '../../test-helpers';

test.describe('Event Templates Management', () => {
  const DELETE_PREFIX = 'ToDelete';

  test.afterEach(async ({ page }) => {
    await deleteEventTemplatesByPattern(page, DELETE_PREFIX);
  });

  test('Delete Event Template', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();

    // 2. Create a new template via the "Create New Event Template" dialog (PR #711).
    //    The name is given a unique prefix so afterEach can clean up if delete fails.
    const uniqueName = `${DELETE_PREFIX} ${Date.now()}`;
    const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(createDialog).toBeVisible();

    await createDialog.getByRole('textbox', { name: /^Name/ }).fill(uniqueName);
    await createDialog.getByRole('spinbutton', { name: 'Duration Hours' }).fill('1');

    // 3. Save and wait for the API to confirm creation (POST)
    await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'POST' &&
        resp.status() >= 200 && resp.status() < 300
      ),
      createDialog.getByRole('button', { name: 'Save' }).click(),
    ]);
    await expect(createDialog).not.toBeVisible();

    // 4. Re-open the freshly created template by name to delete it
    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await page.getByRole('button', { name: `Edit: ${uniqueName}` }).click();
    await expect(editDialog).toBeVisible();

    // 5. Click 'Delete' button within the edit dialog
    await editDialog.getByRole('button', { name: 'Delete' }).click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible();

    // 7. Confirm deletion and wait for the API to complete (DELETE)
    await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'DELETE' &&
        resp.status() >= 200 && resp.status() < 300
      ),
      confirmDialog.getByRole('button', { name: 'Delete' }).click(),
    ]);

    // expect: Both dialogs close after deletion
    await expect(confirmDialog).not.toBeVisible();
    await expect(editDialog).not.toBeVisible();

    // expect: The table is still visible
    await expect(page.getByRole('table')).toBeVisible();
  });
});
