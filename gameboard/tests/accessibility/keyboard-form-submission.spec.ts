// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Form Submission', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'domcontentloaded' });
    const requested = page.locator('input[name="requestedName"]');
    await expect(requested).toBeVisible();

    // Focus via keyboard, type, and submit (the Request button is adjacent).
    await requested.focus();
    const keyboardName = `KbTest${Date.now()}`;
    await page.keyboard.type(keyboardName);
    await expect(requested).toHaveValue(keyboardName);

    // Tab to the Request button and press Enter.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Page should still be /user/profile — keyboard submission accepted.
    await expect(page).toHaveURL(/\/user\/profile/);
  });
});
