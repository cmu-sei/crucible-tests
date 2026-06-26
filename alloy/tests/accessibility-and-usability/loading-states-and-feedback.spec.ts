// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Loading States and Feedback', async ({ page }) => {
    // Use a unique template name to avoid collisions with leftover data from previous runs
    const uniqueName = `Loading Test Template ${Date.now()}`;

    // 1. Navigate to admin page and trigger an action
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Observe the UI during page load
    // expect: The table loads with data
    await expect(page.getByRole('table')).toBeVisible();

    // 3. Trigger an action (create template) - "Add Event Template" opens the
    //    "Create New Event Template" dialog (Alloy.ui PR #711).
    const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(createDialog).toBeVisible();

    // Fill in the form with a unique name
    await createDialog.getByRole('textbox', { name: 'Name (required)' }).fill(uniqueName);
    await createDialog.getByRole('spinbutton', { name: 'Duration Hours' }).fill('1');

    // Click save
    await createDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Success - the template appears in the list with the given name
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible();

    // Clean up: delete the template. Scope the Delete button to the edit dialog —
    // an unscoped name:'Delete' substring-matches edit-row buttons of parallel
    // tests' templates (e.g. "Edit: ToDelete ..."), causing strict-mode failures.
    const editDialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await page.getByRole('button', { name: `Edit: ${uniqueName}` }).click();
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('button', { name: 'Delete' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Delete Event Template' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Yes' }).click();

    // Verify the template is removed from the table
    await expect(page.getByRole('cell', { name: uniqueName })).not.toBeVisible();
  });
});
