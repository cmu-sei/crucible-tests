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
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // 2. Click the add subscription button
    await page
      .locator('app-admin-subscription-search')
      .locator('button:has(mat-icon[fonticon="mdi-plus-circle"])')
      .click();

    // expect: A dialog or form opens to create a new webhook subscription
    // expect: Fields for subscription name, URL, event types are available
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(dialog.getByRole('textbox', { name: 'Callback URL' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Events' })).toBeVisible();
  });
});
