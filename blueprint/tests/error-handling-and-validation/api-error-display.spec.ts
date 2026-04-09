// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  // FIXME: Blueprint does not display user-facing error notifications for API failures
  // When an API error occurs (tested with POST /api/msels and PUT /api/msels/:id),
  // the application silently fails without showing a snackbar or error message to the user.
  // The error only appears in the browser console, which is not accessible to end users.
  // Expected behavior: The application should display a Material snackbar or similar notification
  // with an actionable error message when API calls fail.
  test.fixme('API Error Display', async ({ blueprintAuthenticatedPage: page }) => {

    // Navigate to the build page
    await page.goto(`${Services.Blueprint.UI}/build`);

    // expect: Build page is visible with MSEL list
    await expect(page).toHaveURL(/.*\/build/, { timeout: 10000 });

    // Wait for specific MSEL content to appear (more reliable than waiting for generic 'table')
    await expect(page.getByRole('button', { name: /Add blank MSEL/i })).toBeVisible({ timeout: 10000 });

    // 1. Open an existing MSEL to edit it
    // Look for "New MSEL" or any other MSEL in the list
    const mselLink = page.locator('a:has-text("New MSEL"), a:has-text("Project Lagoon")').first();
    await expect(mselLink).toBeVisible({ timeout: 5000 });
    await mselLink.click();

    // expect: MSEL edit page is displayed
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*\/build\?msel=/, { timeout: 10000 });

    // Wait for the form to load
    const nameField = page.getByRole('textbox', { name: /^Name$/i });
    await expect(nameField).toBeVisible({ timeout: 5000 });

    // 2. Set up route interception to simulate an API error when saving
    // Intercept the PUT/PATCH request for updating the MSEL and return a 500 error
    let interceptedRequest = false;
    await page.route('**/api/msels/*', async (route) => {
      const method = route.request().method();
      if (method === 'PUT' || method === 'PATCH') {
        interceptedRequest = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to update MSEL due to a database error'
          })
        });
      } else {
        await route.continue();
      }
    });

    // 3. Modify the MSEL name to trigger a save operation
    // Use triple-click to select all, then type to ensure Angular change detection fires
    await nameField.click({ clickCount: 3 });
    await page.keyboard.type('Modified MSEL Name for Error Test');

    // expect: Save button becomes enabled
    const saveButton = page.getByRole('button', { name: /Save Changes/i });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });

    // 4. Click the Save button to trigger the API error
    await saveButton.click();

    // Wait for the API call to be intercepted
    await page.waitForTimeout(2000);

    // Verify the API request was intercepted
    expect(interceptedRequest).toBe(true);

    // ISSUE: The following step fails because Blueprint does not display error notifications
    // The API error is logged to the browser console but no snackbar/toast appears
    // Console shows: "Failed to load resource: the server responded with a status of 500"
    // The form is silently reset (Save button becomes disabled) without user feedback

    // 5. Observe application response
    // expect: Error notification or message is displayed
    const errorNotification = page.locator(
      'mat-snack-bar-container, ' +
      '[class*="snack"], ' +
      '[class*="toast"], ' +
      '[class*="notification"], ' +
      '[role="alert"]'
    ).filter({
      hasText: /error|fail|unable|cannot|invalid/i
    });

    await expect(errorNotification.first()).toBeVisible({ timeout: 5000 });

    // expect: Error message is clear and actionable
    const errorText = await errorNotification.first().textContent();
    expect(errorText).toBeTruthy();
    expect(errorText?.length || 0).toBeGreaterThan(0);

    // expect: The error message contains relevant information
    expect(errorText?.toLowerCase()).toMatch(/error|fail|unable|cannot/);

    // 6. Verify that the system remains functional after the error
    await page.unroute('**/api/msels/*');

    // Verify the MSEL edit page is still accessible
    await expect(page).toHaveURL(/.*\/build\?msel=/);

    // expect: Save button is still enabled (user can retry)
    await expect(saveButton).toBeEnabled();

    // expect: The form fields are still editable
    await expect(nameField).toBeEnabled();

    // 7. User can correct any issues and retry
    // The name field should still contain the modified value
    await expect(nameField).toHaveValue('Modified MSEL Name for Error Test');
  });
});
