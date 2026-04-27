// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('Add New Subscription', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // 2. Click the 'Add New Subscription' button
    await page.getByRole('button', { name: 'Add New Subscription' }).click();

    // expect: A dialog or form opens to create a new webhook subscription
    // expect: Fields for subscription name, URL, event types are available
    // The form should appear with input fields
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 5000 });
  });
});
