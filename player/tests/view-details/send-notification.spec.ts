// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('View Details', () => {
  test('Send System Notification', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // 2. Click the 'Notifications' button
    await page.getByRole('button', { name: 'Notifications' }).click();

    // expect: A notification panel opens
    // expect: A text field for entering notification message is shown
    const notificationInput = page.getByRole('textbox').last();
    await expect(notificationInput).toBeVisible({ timeout: 5000 });

    // expect: A character counter shows '0 / 225'
    await expect(page.getByText('0 / 225')).toBeVisible();

    // expect: A 'Send' button is visible
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();

    // 3. Enter a notification message
    await notificationInput.fill('Test notification message');

    // expect: The message is entered in the text field
    await expect(notificationInput).toHaveValue('Test notification message');

    // expect: The character counter updates to show characters used
    await expect(page.getByText('25 / 225')).toBeVisible();

    // 4. Click the 'Send' button
    await page.getByRole('button', { name: 'Send' }).click();

    // expect: A confirmation dialog appears
    await expect(page.getByRole('dialog', { name: 'Confirm Message Send' })).toBeVisible();

    // 5. Confirm the notification by clicking 'YES'
    await page.getByRole('button', { name: 'YES' }).click();

    // expect: The notification is sent to all users in the view
    // expect: The text field is cleared
    await expect(notificationInput).toHaveValue('');
  });
});
