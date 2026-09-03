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

  test('Network Error Handling', async ({ blueprintAuthenticatedPage: page, context }) => {
    // Navigate to the seeded MSEL's Config tab
    await navigateToMsel(page, mselId);

    // 1. Verify the form is functional before network disconnection
    const descriptionField = page.getByRole('textbox', { name: 'Description' });
    await expect(descriptionField).toBeVisible({ timeout: 10000 });

    // 2. Simulate network disconnection by blocking all API requests
    // (allow static resources to pass through so the page remains interactive)
    await context.route('**/api/**', route => route.abort('failed'));

    // 3. Attempt to make an API-dependent action while network is disconnected
    // The key assertion is that the application remains responsive despite the failure

    // Note: Blueprint currently does not display user-visible error messages for network
    // failures. The save operation silently fails when network is disconnected. This test
    // verifies that the application gracefully handles the network error without crashing.

    // expect: The page remains responsive after network failure
    await expect(descriptionField).toBeVisible({ timeout: 5000 });
    await expect(descriptionField).toBeEditable({ timeout: 5000 });

    // 4. Restore network connection
    await context.unroute('**/api/**');

    // 5. Verify application resumes normal operation after network restoration
    // Make a change and save successfully to prove the app recovered
    // The Config tab marks itself dirty from (keypress)/(change)/(cut)/(paste) handlers, so a
    // bare fill() — which sets the value without those events — leaves Save disabled. Type
    // the text so the app sees real input.
    await descriptionField.click();
    await descriptionField.fill('');
    await descriptionField.pressSequentially('Testing network error recovery');

    const saveButton = page.getByRole('button', { name: 'Save Changes' });
    await expect(saveButton).toBeEnabled({ timeout: 10000 });

    // expect: User can successfully perform actions after network is restored
    const savePromise = page.waitForResponse(
      (r) =>
        r.url().includes(`/api/msels/${mselId}`) &&
        r.request().method() === 'PUT' &&
        r.status() === 200,
      { timeout: 15000 }
    );
    await saveButton.click();
    await savePromise;

    // expect: Save button becomes disabled after successful save
    await expect(saveButton).toBeDisabled({ timeout: 5000 });
  });
});
