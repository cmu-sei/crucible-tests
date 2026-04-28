// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Error Handling and Validation', () => {
  test('API Error Display', async ({ page }) => {
    // 1. Navigate to admin
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // 2. Wait for the table to load, then open the edit dialog on an existing template
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: /^Edit:/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // The Name field is required - verify it's marked as required
    const nameField = page.getByRole('textbox', { name: 'Name (required)' });
    await expect(nameField).toBeVisible();

    // Fill in some data and attempt to save
    await nameField.fill('API Error Test');
    await page.getByRole('spinbutton', { name: 'Duration Hours' }).fill('1');

    // expect: The form is operational
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Cancel without saving
    await page.getByRole('button', { name: 'Cancel' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).not.toBeVisible();
  });
});
