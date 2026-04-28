// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Error Handling and Validation', () => {
  test('Data Type Validation', async ({ page }) => {
    // 1. Open a form with typed fields (numeric duration field)
    await authenticateWithKeycloak(page, Services.Alloy.UI);
    await page.goto(`${Services.Alloy.UI}/admin`);
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Wait for the table to load, then open the edit dialog on an existing template
    await expect(page.getByRole('table')).toBeVisible();
    await page.getByRole('button', { name: /^Edit:/ }).first().click();

    // expect: Form is displayed
    await expect(page.getByRole('dialog', { name: 'Edit Event Template' })).toBeVisible();

    // 2. The Duration Hours field is a spinbutton (number input)
    const durationField = page.getByRole('spinbutton', { name: 'Duration Hours' });
    await expect(durationField).toBeVisible();

    // 3. Enter valid numeric data
    await durationField.fill('5');
    await expect(durationField).toHaveValue('5');

    // expect: Validation passes for valid numeric input

    // Cancel without saving
    await page.getByRole('button', { name: 'Cancel' }).first().click();
  });
});
