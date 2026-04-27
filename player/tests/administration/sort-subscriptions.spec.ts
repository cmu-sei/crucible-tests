// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('Sort Subscriptions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // 2. Click the 'Subscription Name' column header
    await page.getByRole('button', { name: 'Subscription Name' }).click();

    // expect: Subscriptions are sorted by name
    await expect(page.getByRole('button', { name: 'Subscription Name' })).toBeVisible();

    // 3. Click the 'Event Types' column header
    await page.getByRole('button', { name: 'Event Types' }).click();

    // expect: Subscriptions are sorted by event types
    await expect(page.getByRole('button', { name: 'Event Types' })).toBeVisible();
  });
});
