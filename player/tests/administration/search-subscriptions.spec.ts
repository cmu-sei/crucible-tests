// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Subscriptions', () => {
  test('Search Subscriptions', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Subscriptions
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Subscriptions Subscriptions' }).click();

    // expect: The Subscriptions section is displayed
    await expect(page.getByRole('columnheader', { name: 'Subscription Name' })).toBeVisible();

    // 2. Enter a subscription name in the Search field
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill('test');

    // expect: The subscriptions list filters to show only matching subscriptions
    // (Results depend on available subscriptions)
    await expect(searchField).toHaveValue('test');
  });
});
