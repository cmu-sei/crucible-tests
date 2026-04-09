// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  const TEST_MSEL_NAME = 'Data Type Validation Test MSEL';

  test.afterEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Cleanup: Delete the test MSEL if it exists
    // Navigate to MSEL list if not already there
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
    const testMselLink = page.getByRole('link', { name: TEST_MSEL_NAME }).first();
    const newMselLink = page.getByRole('link', { name: 'New MSEL' }).first();

    // Try to find and delete the test MSEL
    let mselToDelete = await testMselLink.isVisible({ timeout: 2000 }).catch(() => false)
      ? testMselLink
      : await newMselLink.isVisible({ timeout: 2000 }).catch(() => false)
      ? newMselLink
      : null;

    if (mselToDelete) {
      await mselToDelete.click();
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

  test('Data Type Validation', async ({ blueprintAuthenticatedPage: page }) => {

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

    // 4. Enable date/time fields by checking "Set a Start Time"
    const setStartTimeCheckbox = page.getByRole('checkbox', { name: 'Set a Start Time' });
    await expect(setStartTimeCheckbox).toBeVisible({ timeout: 5000 });
    await setStartTimeCheckbox.check();

    // expect: Date/time picker fields are now visible
    await page.waitForTimeout(500);
    const startDateButton = page.locator('mat-form-field').filter({ hasText: 'Start Date / Time' }).getByLabel('Open calendar');
    await expect(startDateButton).toBeVisible({ timeout: 5000 });

    // 5. Open the date/time picker
    await startDateButton.click();

    // expect: Date/time picker dialog is displayed
    await page.waitForTimeout(500);
    const dateDialog = page.locator('mat-calendar, [role="dialog"]').filter({ hasText: /APR|Start Date/ }).first();
    await expect(dateDialog).toBeVisible({ timeout: 5000 });

    // 6. Test invalid time input - try to enter invalid hour value
    const hourInput = page.locator('input[type="text"]').filter({ hasText: /^\d{2}$/ }).first();
    if (await hourInput.isVisible({ timeout: 2000 })) {
      // Clear and enter invalid hour value (greater than 12)
      await hourInput.clear();
      await hourInput.fill('99');
      await hourInput.blur();

      // Try to save
      const saveButton = page.getByRole('button', { name: 'Save' }).first();
      if (await saveButton.isVisible({ timeout: 2000 })) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // 7. Close the date picker
    // Use Escape key to close the date picker overlay
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 8. Test the Name field with max length validation
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // Clear existing value
    await nameField.clear();

    // Try to enter a name that exceeds the max length (70 characters)
    const longName = 'A'.repeat(100);
    await nameField.fill(longName);

    // expect: Input is truncated or validation message appears
    await page.waitForTimeout(500);
    const nameValue = await nameField.inputValue();
    const charCounter = page.locator('text=/\\d+ \\/ 70 characters/');

    // Check if the character counter shows the limit
    if (await charCounter.isVisible({ timeout: 2000 })) {
      const counterText = await charCounter.textContent();
      expect(counterText).toContain('70 characters');
    }

    // expect: Name should be truncated to 70 characters or less
    expect(nameValue.length).toBeLessThanOrEqual(70);

    // 9. Enter valid name
    await nameField.clear();
    await nameField.fill(TEST_MSEL_NAME);

    // 10. Save the changes
    const saveChangesButton = page.getByRole('button', { name: 'Save Changes' });
    if (await saveChangesButton.isEnabled({ timeout: 2000 })) {
      await saveChangesButton.click();
      await page.waitForTimeout(1000);

      // expect: Changes are saved successfully
      const unsavedChangesMessage = page.locator('text=/Changes have not been saved/');
      const messageVisible = await unsavedChangesMessage.isVisible({ timeout: 2000 }).catch(() => false);
      expect(messageVisible).toBe(false);
    }

    // Cleanup will happen automatically in test.afterEach()
  });
});
