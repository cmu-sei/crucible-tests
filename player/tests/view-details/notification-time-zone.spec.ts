// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  seededPrimaryViewName,
  findPlayerHomeViewLink,
  clickWithoutOverlayInterference,
} from '../../fixtures';

test.describe('View Details', () => {
  // Pin a DST zone so the label is a real abbreviation (EDT/EST), not UTC
  test.use({ timezoneId: 'America/New_York' });

  test('Notification time shows the viewer time zone', async ({ playerAuthenticatedPage: page }) => {
    const message = `TZ label ${Date.now()}`;

    // 1. Open a view and its notification panel
    await (await findPlayerHomeViewLink(page, seededPrimaryViewName())).click();
    await expect(page).toHaveURL(/\/view\//, { timeout: 10000 });
    const notificationsToggle = page.getByRole('button', { name: 'Notifications' });
    await clickWithoutOverlayInterference(page, notificationsToggle);
    await expect(notificationsToggle).toHaveAttribute('aria-expanded', 'true');

    // 2. Send a notification
    await page.getByPlaceholder('Send system wide notification').fill(message);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm Message Send' });
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(dialog).toBeHidden();

    // expect: The new notification's time carries the browser's zone abbreviation
    // for that date (e.g. "EDT"), and the hover title ends with it
    const row = page.locator('mat-list-item', { hasText: message });
    await expect(row).toBeVisible({ timeout: 10000 });
    const time = row.locator('#time');
    const zone = await page.evaluate(
      () =>
        new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
          .formatToParts(new Date())
          .find((part) => part.type === 'timeZoneName')?.value ?? ''
    );
    expect(zone).toMatch(/^E[DS]T$/);
    await expect(time.locator('.zone')).toHaveText(zone);
    await expect(time).toHaveAttribute('title', new RegExp(` ${zone}$`));
  });
});
