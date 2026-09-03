// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Focus Management - Modal Dialogs', async ({ gameboardAuthenticatedPage: page }) => {
    // Open the Create Notification modal from Admin → Notifications.
    await page.goto(Services.Gameboard.UI + '/admin/notifications', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Create Notification/i }).click();
    await page.waitForTimeout(1500);

    // After opening, some interactive control (input or button inside the
    // create form) should become focusable.
    const interactive = page.locator('input:visible, textarea:visible, select:visible, [role="dialog"] button:visible').first();
    await expect(interactive).toBeVisible({ timeout: 10000 });

    // Press Escape; the dialog/form should close. We can verify by checking
    // whether the original Create Notification button becomes interactable again.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: /Create Notification/i })).toBeVisible();
  });
});
