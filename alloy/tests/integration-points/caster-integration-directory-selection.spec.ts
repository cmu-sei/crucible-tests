// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Integration Points', () => {
  test('Caster Integration - Directory Selection', async ({ page }) => {
    // 1. Navigate to create or edit event template form
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Create a new event template if none exists
    await page.getByRole('button', { name: 'Add Event Template' }).click();

    // Wait for the new template to appear and click edit
    await page.getByRole('button', { name: /^Edit: / }).first().click();

    // expect: Form is displayed
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 2. Check the Caster Directory dropdown
    const casterDirectoryCombobox = page.getByRole('combobox', { name: 'Caster Directory' });

    // expect: Dropdown is visible
    await expect(casterDirectoryCombobox).toBeVisible();

    // Close the dialog
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
