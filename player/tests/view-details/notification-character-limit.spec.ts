// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('Notification Character Limit', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view, then open the Notifications panel
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    await page.getByRole('button', { name: 'Notifications' }).click();

    // expect: The notification panel is open
    const notificationInput = page.getByRole('textbox', { name: 'Send system wide notification' });
    await expect(notificationInput).toBeVisible();
    await expect(page.getByText('0 / 225')).toBeVisible();

    // 2. Enter a message of exactly 225 characters (the maximum)
    const maxMessage = 'A'.repeat(225);
    await notificationInput.fill(maxMessage);

    // expect: The character counter shows '225 / 225'
    await expect(page.getByText('225 / 225')).toBeVisible();
  });
});
