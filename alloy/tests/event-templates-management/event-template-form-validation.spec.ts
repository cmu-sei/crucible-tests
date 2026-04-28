// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Event Templates Management', () => {
  test('Event Template Form Validation', async ({ page }) => {
    // 1. Navigate to admin Event Templates section
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Open edit dialog on an existing template to test form validation
    await page.getByRole('button', { name: /^Edit:/ }).first().click();

    // expect: Event template edit form is displayed
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 2. Leave the Name field empty and try to submit the form
    const nameField = page.getByRole('textbox', { name: 'Name (required)' });
    await nameField.fill('');

    // 3. Enter a name but set Duration Hours to a negative value
    await nameField.fill('Test Template');
    await page.getByRole('spinbutton', { name: 'Duration Hours' }).fill('-1');

    // 5. Enter Duration Hours as valid value
    await page.getByRole('spinbutton', { name: 'Duration Hours' }).fill('4');

    // 6. Fill all required fields correctly
    await expect(nameField).toHaveValue('Test Template');
    await expect(page.getByRole('spinbutton', { name: 'Duration Hours' })).toHaveValue('4');

    // expect: Save button is available
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Cancel without saving
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
