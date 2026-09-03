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
  tempBlueprintName,
  updateMsel,
  getMsel,
} from '../../test-helpers';

test.describe('Error Handling and Validation', () => {
  let token: string;
  let mselId: string;
  const testMselName = tempBlueprintName('DataTypeVal');

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token, { name: testMselName });
    mselId = msel.id;
  });

  test.afterEach(async () => {
    if (mselId) {
      await deleteMsel(token, mselId);
    }
  });

  test('Data Type Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL's Config tab
    await navigateToMsel(page, mselId);

    // 1. Test the Name field with max length validation (already covered by msel-character-limit-validation)
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 10000 });

    // Try to enter a name that exceeds the max length (70 characters)
    const longName = 'A'.repeat(100);
    await nameField.click();
    await nameField.fill(longName);

    const nameValue = await nameField.inputValue();
    // expect: Input is truncated to 70 characters (enforced by maxlength attribute)
    expect(nameValue.length).toBeLessThanOrEqual(70);

    // Verify the character counter shows the limit
    const charCounter = page.locator('text=/\\d+ \\/ 70 characters/').first();
    await expect(charCounter).toBeVisible({ timeout: 5000 });

    // 2. Test that the Description field also enforces its character limit
    const descField = page.getByRole('textbox', { name: 'Description' });
    await expect(descField).toBeVisible({ timeout: 5000 });

    const longDesc = 'B'.repeat(700);
    await descField.click();
    await descField.fill(longDesc);

    const descValue = await descField.inputValue();
    // expect: Description is truncated to 600 characters
    expect(descValue.length).toBeLessThanOrEqual(600);

    // 3. This test primarily validates that the UI enforces maxlength constraints on text fields.
    // The character limit validation (70 for name, 600 for description) is the key data type
    // validation Blueprint enforces client-side. The test above confirms both limits work correctly.
  });
});
