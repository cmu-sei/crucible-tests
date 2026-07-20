// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('View Details', () => {
  test('Send System Notification', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in and navigate to a view
    await page.getByRole('link', { name: 'Project Lagoon TTX - Admin' }).click();

    // expect: User is on the view details page
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });

    // 2. Click the 'Notifications' button
    await page.getByRole('button', { name: 'Notifications' }).click();

    // expect: A notification panel opens with its system notification field
    const notificationInput = page.getByPlaceholder('Send system wide notification');
    await expect(notificationInput).toBeVisible();

    // expect: A character counter shows '0 / 225'
    await expect(page.getByText('0 / 225')).toBeVisible();

    // expect: A 'Send' button is visible
    const sendButton = page.getByRole('button', { name: 'Send', exact: true });
    await expect(sendButton).toBeVisible();

    // 3. Enter a notification message
    await notificationInput.fill('Test notification message');

    // expect: The message is entered in the text field
    await expect(notificationInput).toHaveValue('Test notification message');

    // expect: The character counter updates to show characters used
    await expect(page.getByText('25 / 225')).toBeVisible();

    // 4. Click the 'Send' button
    await sendButton.click();

    // expect: A confirmation dialog explains the broadcast audience
    const confirmationDialog = page.getByRole('dialog', { name: 'Confirm Message Send' });
    await expect(confirmationDialog).toBeVisible();
    await expect(confirmationDialog).toContainText(
      'Are you sure that you want to send a system wide message to all users logged into this view?'
    );

    // 5. Confirm the notification
    await confirmationDialog.getByRole('button', { name: 'Send', exact: true }).click();

    // expect: The confirmation closes and the form is reset for another message
    await expect(confirmationDialog).toBeHidden();
    await expect(notificationInput).toHaveValue('');
  });
});
