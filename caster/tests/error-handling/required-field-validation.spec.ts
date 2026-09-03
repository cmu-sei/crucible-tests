// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Required Field Validation', async ({ casterAuthenticatedPage: page }) => {

    await expect(page.getByText('My Projects')).toBeVisible();
    await page.locator('button[mattooltip="Add New Project"]').click();
    await expect(page.getByRole('dialog', { name: /Create New Project/i })).toBeVisible();

    // expect: Save button is disabled when Name field is empty
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(page.getByRole('dialog', { name: /Create New Project/i }).locator('.mat-mdc-form-field-required-marker')).toBeVisible();

    // Fill and verify Save becomes enabled
    await page.getByRole('textbox', { name: /name/i }).fill('Valid Project Name');
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

    // Clear and verify Save becomes disabled again
    await page.getByRole('textbox', { name: /name/i }).fill('');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
