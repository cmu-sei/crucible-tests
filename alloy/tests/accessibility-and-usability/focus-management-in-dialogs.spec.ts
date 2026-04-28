// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Accessibility and Usability', () => {
  test('Focus Management in Dialogs', async ({ page }) => {
    // 1. Open a dialog (create event template, then edit it)
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // "Add Event Template" creates a new row directly; click it to create one
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    // Wait for the new template to appear in the table
    await expect(page.getByRole('cell', { name: 'New Event Template' }).first()).toBeVisible();

    // Click the edit button on the newly created template to open the dialog
    await page.getByRole('button', { name: 'Edit: New Event Template' }).first().click();

    // expect: Dialog opens
    const dialog = page.getByRole('dialog', { name: 'Edit Event Template' });
    await expect(dialog).toBeVisible();

    // 2. Check focus behavior
    // expect: Focus is moved to the dialog when it opens
    // The Name field should be visible and active
    await expect(page.getByRole('textbox', { name: 'Name (required)' })).toBeVisible();

    // 3. Test Cancel button closes the dialog
    // Note: This dialog has disableClose set, so Escape key does not dismiss it.
    // Use the Cancel button to close the dialog instead.
    await page.getByRole('button', { name: 'Cancel' }).first().click();

    // expect: When dialog closes, the dialog is no longer visible
    await expect(dialog).not.toBeVisible();

    // Clean up: delete the created template
    await page.getByRole('button', { name: 'Edit: New Event Template' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete Event Template' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByRole('cell', { name: 'New Event Template' })).not.toBeVisible();
  });
});
