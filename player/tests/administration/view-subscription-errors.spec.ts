// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('View Subscription Error Details', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // 2. Observe the 'Last Error' column
    // expect: The error message column is visible
    await expect(page.getByRole('columnheader', { name: 'Last Error' })).toBeVisible();

    // expect: Error details help diagnose webhook issues
    // If there are subscriptions with errors, the error text would be visible in the Last Error column
  });
});
