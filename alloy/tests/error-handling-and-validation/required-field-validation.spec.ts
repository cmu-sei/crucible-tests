// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';
import { createTestEventTemplate, deleteEventTemplateByName } from '../../test-helpers';

test.describe('Error Handling and Validation', () => {
  // Track the template seeded for this test so it can be cleaned up.
  let seededTemplateName: string | null = null;

  test.afterEach(async ({ page }) => {
    if (seededTemplateName) {
      await deleteEventTemplateByName(page, seededTemplateName);
      seededTemplateName = null;
    }
  });

  test('Required Field Validation', async ({ page }) => {
    // 1. Open the create event template form
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Seed a template so the test never depends on pre-existing data — an empty
    // list previously made the `Edit: .first()` click time out.
    await expect(page.getByRole('table')).toBeVisible();
    seededTemplateName = `Required Field Test ${Date.now()}`;
    await createTestEventTemplate(page, seededTemplateName);

    // Open the seeded template's edit dialog
    await page.getByRole('button', { name: `Edit: ${seededTemplateName}` }).click();

    // expect: Form is displayed
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 2. The Name field is required
    const nameField = page.getByRole('textbox', { name: 'Name (required)' });
    await expect(nameField).toBeVisible();

    // Verify the field label indicates it's required
    await expect(page.getByText('Name (required)')).toBeVisible();

    // 3. Fill required fields correctly
    await nameField.fill('Valid Template Name');
    await expect(nameField).toHaveValue('Valid Template Name');

    // expect: Save button is available
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Cancel without saving
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
