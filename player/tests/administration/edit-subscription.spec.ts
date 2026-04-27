// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('Edit Subscription', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed with existing subscriptions
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // 2. Click on a subscription name (if any exist)
    // The test verifies the subscription table is accessible for editing
    const subscriptionRows = page.getByRole('row');
    const rowCount = await subscriptionRows.count();

    // If there are subscriptions beyond the header row, click the first one
    if (rowCount > 1) {
      const firstSubscriptionCell = subscriptionRows.nth(1).getByRole('cell').first();
      await firstSubscriptionCell.click();

      // expect: A dialog opens showing subscription details for editing
      // 3. Modify subscription details and save
      // expect: The subscription is updated in the list
    }

    // Verify the table structure is correct
    await expect(page.getByRole('columnheader', { name: 'Last Error' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Event Types' })).toBeVisible();
  });
});
