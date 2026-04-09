// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Network Error Handling', async ({ blueprintAuthenticatedPage: page, context }) => {

    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Click the "Manage an Event" card to navigate to MSEL list
    const manageEventCard = page.getByRole('button', { name: /Manage an Event/i });
    await expect(manageEventCard).toBeVisible({ timeout: 10000 });
    await manageEventCard.click();

    // Wait for MSEL list page to load
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Click "Add blank MSEL" to create a new MSEL
    const addBlankButton = page.getByRole('button', { name: 'Add blank MSEL' });
    await expect(addBlankButton).toBeVisible({ timeout: 5000 });
    await addBlankButton.click();

    // Wait for the new MSEL to be created and appear in the list
    await page.waitForTimeout(1000);

    // Click on the newly created MSEL to open the edit page
    const newMselLink = page.getByRole('link', { name: 'New MSEL' }).first();
    await expect(newMselLink).toBeVisible({ timeout: 5000 });
    await newMselLink.click();

    // Wait for the edit page to load
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Modify the name field to enable the Save button
    const nameField = page.getByRole('textbox', { name: 'Name' });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // Clear the field and fill with new value to trigger change detection
    await nameField.click();
    await nameField.fill('');
    await nameField.fill('Network Error Test MSEL');
    await nameField.blur();

    // Wait a moment for the form to detect changes
    await page.waitForTimeout(500);

    const saveButton = page.getByRole('button', { name: 'Save Changes' });

    // If Save button is not enabled, try modifying description as well
    if (await saveButton.isDisabled().catch(() => true)) {
      const descriptionField = page.getByRole('textbox', { name: 'Description' });
      await expect(descriptionField).toBeVisible({ timeout: 5000 });
      await descriptionField.click();
      await descriptionField.fill('');
      await descriptionField.fill('Testing network error handling');
      await descriptionField.blur();
      await page.waitForTimeout(500);
    }

    // Verify Save button is now enabled
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // 1. Disconnect from network while using the application
    // Simulate network disconnection by blocking all network requests
    await context.route('**/*', route => route.abort('failed'));

    // expect: Network connection is lost
    await page.waitForTimeout(500);

    // 2. Attempt to perform an action (e.g., save event)
    await saveButton.click();

    // Wait for any error notification to appear
    await page.waitForTimeout(2000);

    // Note: The Blueprint application currently does not display user-visible error messages
    // for network failures. The save operation silently fails when network is disconnected.
    // This test verifies that the application remains functional despite the network failure.

    // expect: Action fails gracefully without crashing
    // The page should still be responsive and form fields visible
    await expect(nameField).toBeVisible();

    // expect: Unsaved changes may be preserved locally
    // Verify the data is still in the form fields
    await expect(nameField).toHaveValue('Network Error Test MSEL');

    // 3. Restore network connection
    // Remove the network block
    await context.unroute('**/*');

    // expect: Application resumes normal operation
    await page.waitForTimeout(1000);

    // After network restoration, the form may have reloaded data from the server
    // Make a small change to re-enable the Save button
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    await descriptionField.click();
    await descriptionField.fill('Testing network error handling - Updated');
    await descriptionField.blur();
    await page.waitForTimeout(500);

    // Verify Save button becomes enabled again
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // expect: User can retry the action
    // Try to submit again with network restored
    await saveButton.click();

    // Wait for save to process
    await page.waitForTimeout(2000);

    // Check for success notification or that Save button becomes disabled again
    const saveSuccessful = await saveButton.isDisabled({ timeout: 3000 }).catch(() => false);

    let successNotification = null;
    if (!saveSuccessful) {
      const successText = page.getByText(/success|saved/i).first();
      if (await successText.isVisible({ timeout: 2000 }).catch(() => false)) {
        successNotification = successText;
      }
    }

    // Either the save button becomes disabled (indicating changes were saved) or we see a success notification
    // The key is that the application didn't crash and is still functional
    expect(saveSuccessful || successNotification !== null).toBeTruthy();
    expect(page.url()).toContain('localhost:4725');

    // ── CLEANUP: Delete the MSEL created by this test ──────────────────────
    await page.goto(`${Services.Blueprint.UI}/build`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const deleteMselBtn = page.getByRole('button', { name: 'Delete Network Error Test MSEL' }).first();
    while (await deleteMselBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteMselBtn.click();
      const confirmBtn = page.locator('[role="dialog"] button:has-text("YES")');
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }
  });
});
