// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Exercises form validation by opening the Admin → Notifications "Create Notification"
// flow. The Save button must be disabled until required fields (Title, Content) are
// supplied.
test.describe('Error Handling', () => {
  test('Form Validation - Required Fields', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin/notifications', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

    await page.getByRole('button', { name: /Create Notification/i }).click();
    await page.waitForTimeout(1500);

    // In the create notification modal, Save should be disabled until required fields are filled.
    const saveBtn = page.getByRole('button', { name: 'Save', exact: true });
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await expect(saveBtn).toBeDisabled();
  });
});
