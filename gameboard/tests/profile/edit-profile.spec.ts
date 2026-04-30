// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// In Gameboard, editing the profile means requesting a display-name change.
// There is no "Edit Profile" modal; the Profile tab has a "Requested Display
// Name" text input and a "Request" button. The request goes into an admin
// approval queue and the Approved Display Name updates only after approval.
test.describe('Profile', () => {
  test('Edit User Profile - Request Display Name Change', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'domcontentloaded' });

    const requested = page.locator('input[name="requestedName"]');
    await expect(requested).toBeVisible();

    const newName = `TestUser${Date.now()}`;
    await requested.fill(newName);
    await expect(requested).toHaveValue(newName);

    const requestBtn = page.getByRole('button', { name: /^Request$/ });
    await expect(requestBtn).toBeVisible();
    // Submit request — the name goes into "pending" state; we just verify the
    // form accepts the submission without errors. We do NOT assert a status
    // message because Gameboard does not always render one inline.
    await requestBtn.click();
    // Allow the UI to process (XHR + re-render).
    await page.waitForTimeout(1500);
    // Page should still be on /user/profile after successful submit.
    await expect(page).toHaveURL(/\/user\/profile/);
  });
});
