// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

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

    // 2. Click 'Add Event Template' to open the "Create New Event Template" dialog.
    //    As of Alloy.ui PR #711 this opens an empty form; the template is only
    //    POSTed when Save is clicked (no default "New Event Template" row anymore).
    const createDialog = page.getByRole('dialog', { name: 'Create New Event Template' });
    await page.getByRole('button', { name: 'Add Event Template' }).click();
    await expect(createDialog).toBeVisible();

    // 3. Enter unique name in the Name field
    const nameField = createDialog.getByRole('textbox', { name: /^Name/ });
    await nameField.fill(uniqueName);
    await expect(nameField).toHaveValue(uniqueName);

    // 4. Enter description in the Description field
    const descriptionField = createDialog.getByRole('textbox', { name: /Description/ });
    await descriptionField.fill('This is a test exercise for validation');
    await expect(descriptionField).toHaveValue('This is a test exercise for validation');

    // 5. Set Duration Hours to '4'
    const durationField = createDialog.getByRole('spinbutton', { name: 'Duration Hours' });
    await durationField.click();
    await durationField.fill('4');
    await expect(durationField).toHaveValue('4');

    // 6. Click 'Save' and wait for the API to confirm creation (POST)
    await Promise.all([
      page.waitForResponse(resp =>
        resp.url().includes('/api/eventtemplates') &&
        resp.request().method() === 'POST' &&
        resp.status() >= 200 && resp.status() < 300
      ),
      createDialog.getByRole('button', { name: 'Save' }).click(),
    ]);

    // expect: The dialog closes and the template appears in the list
    await expect(createDialog).not.toBeVisible();

    // The API confirmed the save (saveResponse). Verify the template is in the list.
    // With parallel tests, SignalR updates may cause the table to re-render.
    // Use the search box to filter to our specific template for reliable verification.
    const searchBox = page.getByRole('textbox', { name: 'Search' });
    await searchBox.fill(uniqueName);
    await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible({ timeout: 15000 });
    await searchBox.fill('');
  });
});
