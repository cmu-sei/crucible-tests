// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  Services,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  clickWithoutOverlayInterference,
} from '../../fixtures';

test.describe('View Details', () => {
  test('Notification Character Limit', async ({ playerAuthenticatedPage: page }) => {
    const primaryViewName = seededPrimaryViewName();

    // 1. Log in and navigate to a view, then open the Notifications panel
    await (await findPlayerHomeViewLink(page, primaryViewName)).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    const notificationsToggle = page.getByRole('button', { name: 'Notifications' });
    await clickWithoutOverlayInterference(page, notificationsToggle);
    await expect(notificationsToggle).toHaveAttribute('aria-expanded', 'true');

    // expect: The notification panel is open
    const notificationInput = page.getByPlaceholder('Send system wide notification');
    await expect(notificationInput).toBeVisible();
    await expect(page.getByText('0 / 225')).toBeVisible();

    // 2. Enter a message of exactly 225 characters (the maximum)
    const maxMessage = 'A'.repeat(225);
    await notificationInput.fill(maxMessage);

    // expect: The character counter shows '225 / 225'
    await expect(page.getByText('225 / 225')).toBeVisible();
  });
});
