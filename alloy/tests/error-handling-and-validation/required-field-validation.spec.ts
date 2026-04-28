// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Error Handling and Validation', () => {
  test('Required Field Validation', async ({ page }) => {
    // 1. Open the create event template form
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Wait for the table to load, then open the edit dialog on an existing template
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: /^Edit:/ }).first().click();

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
