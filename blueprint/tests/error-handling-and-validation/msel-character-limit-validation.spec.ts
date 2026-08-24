// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
} from '../../test-helpers';

test.describe('Error Handling and Validation', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      await deleteMsel(token, mselId);
    }
  });

  test('MSEL Character Limit Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL's Config tab
    await navigateToMsel(page, mselId);

    // 1. Test the Name field character limit
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 10000 });

    // Clear and fill with test data to verify the counter appears
    await nameField.click();
    await nameField.fill('Test MSEL Name');

    // expect: Name field shows character counter (e.g., '15 / 70 characters') with 70 character maximum
    const nameCharCounter = page.locator('text=/\\d+ \\/ 70 characters/').first();
    await expect(nameCharCounter).toBeVisible({ timeout: 5000 });

    // Try to type more than 70 characters in name field
    const seventyOneChars = 'A'.repeat(71);
    await nameField.fill(seventyOneChars);

    const nameValue = await nameField.inputValue();
    // expect: The field should not accept more than 70 characters (enforced by maxlength attribute)
    expect(nameValue.length).toBeLessThanOrEqual(70);

    // 2. Test the Description field character limit
    const descField = page.getByRole('textbox', { name: 'Description' });
    await expect(descField).toBeVisible({ timeout: 5000 });

    // Clear and fill with test data
    await descField.click();
    await descField.fill('Test description');

    // expect: Description field shows character counter (e.g., '16 / 600 characters') with 600 character maximum
    const descCharCounter = page.locator('text=/\\d+ \\/ 600 characters/').first();
    await expect(descCharCounter).toBeVisible({ timeout: 5000 });

    // Try to type more than 600 characters in description
    const sixHundredOneChars = 'B'.repeat(601);
    await descField.fill(sixHundredOneChars);

    const descValue = await descField.inputValue();
    // expect: The field should not accept more than 600 characters (enforced by maxlength attribute)
    expect(descValue.length).toBeLessThanOrEqual(600);
  });
});
