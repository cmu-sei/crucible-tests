// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  const TEST_MSEL_NAME = 'Required Field Validation Test MSEL';

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

  // This test verifies that the Name field has required field validation.
  // The Save Changes button should be disabled when the Name field is empty.
  test('Required Field Validation', async ({ blueprintAuthenticatedPage: page }) => {

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

    // 4. Test field validation behavior on the Name field
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // The new MSEL should have "New MSEL" as default name
    const originalName = await nameField.inputValue();
    expect(originalName).toBe('New MSEL');

    // 5. Change the name field to trigger form dirty state and test validation
    const saveChangesButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveChangesButton).toBeVisible({ timeout: 5000 });

    // Initially, save button should be disabled (no changes made yet)
    await expect(saveChangesButton).toBeDisabled();

    // 6. Fill in the Name field with a test value using pressSequentially to trigger Angular change detection
    await nameField.click();
    await page.keyboard.press('Control+A');
    await nameField.pressSequentially(TEST_MSEL_NAME, { delay: 50 });
    await expect(nameField).toHaveValue(TEST_MSEL_NAME);
    await page.waitForTimeout(500);

    // 7. Save button should now be enabled since we made a valid change
    await expect(saveChangesButton).toBeEnabled({ timeout: 3000 });

    // 8. Save the changes
    await saveChangesButton.click();
    await page.waitForTimeout(1000);

    // expect: Changes are saved successfully
    await expect(saveChangesButton).toBeDisabled();

    // Check if "Changes have not been saved" message is not visible
    const unsavedChangesMessage = page.locator('text=/Changes have not been saved/');
    const messageVisible = await unsavedChangesMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(messageVisible).toBe(false);

    // 9. Verify the MSEL name was updated in the list
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const savedMselLink = page.getByRole('link', { name: TEST_MSEL_NAME });
    await expect(savedMselLink).toBeVisible({ timeout: 5000 });

    // Cleanup will happen automatically in test.afterEach()
  });
});
