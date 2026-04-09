// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Validation', () => {
  test('Unauthorized Action Handling', async ({ blueprintAuthenticatedPage: page, context }) => {
    // Since we only have admin credentials, we'll test unauthorized action handling
    // by intercepting API calls and simulating 403 responses

    // expect: User is authenticated
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('load');

    // Navigate to the admin page
    await page.goto('http://localhost:4725');
    await page.waitForLoadState('load');

    // Click on Admin User button to open the menu
    await page.getByRole('button', { name: 'Admin User' }).click();

    // Click on Administration menu item
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: User is on the admin page
    await expect(page).toHaveURL('http://localhost:4725/admin');
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Set up API interception to simulate 403 Forbidden response for system-roles
    // We'll intercept the system-roles API which is called when viewing Users
    let unauthorizedResponseReceived = false;
    await page.route('**/api/system-roles', (route) => {
      unauthorizedResponseReceived = true;
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to access this resource'
        })
      });
    });

    // Navigate to Users section, which will trigger the intercepted API call
    await page.getByText('Users').click();

    // Wait a moment for the API call to be made
    await page.waitForTimeout(500);

    // expect: The intercepted 403 response was received
    expect(unauthorizedResponseReceived).toBe(true);

    // expect: The application handles the 403 gracefully by showing an error dialog
    const errorDialog = page.getByRole('dialog');
    await expect(errorDialog).toBeVisible();

    // expect: Error dialog shows Forbidden message
    await expect(page.getByRole('heading', { name: 'Forbidden' })).toBeVisible();
    await expect(page.getByText(/403 Forbidden/)).toBeVisible();

    // expect: The page hasn't crashed - check that a table element exists in the DOM
    const tableExists = await page.evaluate(() => !!document.querySelector('table'));
    expect(tableExists).toBe(true);

    // Close the error dialog by clicking the close button
    await page.getByRole('dialog').locator('button').click();

    // expect: After closing dialog, the page is still functional
    await expect(page.getByText('Users').first()).toBeVisible();

    // expect: After closing dialog, the page is still functional
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

    // Clean up the route interception
    await page.unroute('**/api/system-roles');

    // Verify the user can navigate to other sections (app is still functional)
    await page.getByText('Units').click();
    await expect(page.getByRole('table')).toBeVisible();

    // expect: User can still access other authorized features
    // Navigate back to home
    await page.goto('http://localhost:4725');
    await page.waitForLoadState('load');

    // expect: Home page is accessible
    await expect(page).toHaveURL('http://localhost:4725/');
    await expect(page.getByRole('button', { name: /Manage an Event/i })).toBeVisible();
  });
});
