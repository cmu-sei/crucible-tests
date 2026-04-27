// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('View Subscriptions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();

    // expect: The Administration page is displayed
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // 2. Click the 'Subscriptions' button
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    await expect(page).toHaveURL(/section=subscriptions/);

    // expect: A table shows subscriptions with columns: Subscription Name, Last Error, Event Types
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Last Error' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Event Types' })).toBeVisible();

    // expect: An 'Add New Subscription' button is visible
    await expect(page.getByRole('button', { name: 'Add New Subscription' })).toBeVisible();
  });
});
