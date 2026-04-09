// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test.afterEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Cleanup: Delete the test MSEL if it exists
    const currentUrl = page.url();
    if (!currentUrl.includes('/build')) {
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('networkidle');
    } else if (currentUrl.includes('?msel=')) {
      // We're on a MSEL detail page, navigate back to list
      await page.goto(`${Services.Blueprint.UI}/build`);
      await page.waitForLoadState('networkidle');
    }

    // Look for the test MSEL or "New MSEL" in the list
    const newMselLink = page.getByRole('link', { name: 'New MSEL' }).first();

    if (await newMselLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newMselLink.click();
      await page.waitForLoadState('networkidle');

      // Delete the MSEL
      const deleteButton = page.getByRole('button', { name: 'Delete this MSEL' });
      if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteButton.click();

        // Confirm deletion in the dialog
        await page.waitForTimeout(500);
        const confirmDialog = page.getByRole('dialog', { name: 'Delete MSEL' });
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          const yesButton = confirmDialog.getByRole('button', { name: 'YES' });
          await yesButton.click();

          // Wait for redirect back to MSEL list
          await expect(page).toHaveURL(/.*\/build$/, { timeout: 10000 });
        }
      }
    }
  });

  test('MSEL Character Limit Validation', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Blueprint MSEL management page
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click on "Manage an Event" button to navigate to Blueprint page
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();

    // Wait for navigation to /build page
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 2. Create a new MSEL by clicking "Add blank MSEL"
    const createButton = page.getByRole('button', { name: 'Add blank MSEL' });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    // expect: New MSEL is created and appears in the list
    await page.waitForTimeout(2000);

    // 3. Open the newly created MSEL (it will be the first "New MSEL" link)
    const newMselLink = page.getByRole('link', { name: 'New MSEL' }).first();
    await expect(newMselLink).toBeVisible({ timeout: 5000 });
    await newMselLink.click();

    // expect: MSEL configuration page is displayed
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 4. Test the Name field character limit
    // expect: Name field shows character counter (e.g., '31 / 70 characters') with 70 character maximum
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // Clear and fill with test data
    await nameField.clear();
    await nameField.fill('Test MSEL Name');

    // Verify character counter is visible
    const nameCharCounter = page.locator('text=/\\d+ \\/ 70 characters/').first();
    await expect(nameCharCounter).toBeVisible({ timeout: 5000 });

    // Try to type more than 70 characters in name field
    const seventyOneChars = 'A'.repeat(71);
    await nameField.fill(seventyOneChars);
    await page.waitForTimeout(300);

    const nameValue = await nameField.inputValue();
    // expect: The field should not accept more than 70 characters (enforced by maxlength or validation)
    expect(nameValue.length).toBeLessThanOrEqual(70);

    // 5. Test the Description field character limit
    // expect: Description field shows character counter (e.g., '176 / 600 characters') with 600 character maximum
    const descField = page.getByRole('textbox', { name: 'Description' });
    await expect(descField).toBeVisible({ timeout: 5000 });

    // Clear and fill with test data
    await descField.clear();
    await descField.fill('Test description');

    // Verify character counter is visible
    const descCharCounter = page.locator('text=/\\d+ \\/ 600 characters/').first();
    await expect(descCharCounter).toBeVisible({ timeout: 5000 });

    // Try to type more than 600 characters in description
    const sixHundredOneChars = 'B'.repeat(601);
    await descField.fill(sixHundredOneChars);
    await page.waitForTimeout(300);

    const descValue = await descField.inputValue();
    // expect: The field should not accept more than 600 characters
    expect(descValue.length).toBeLessThanOrEqual(600);

    // Cleanup will happen automatically in test.afterEach()
  });
});
