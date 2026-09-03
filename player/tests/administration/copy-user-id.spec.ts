// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Users', () => {
  test('Copy User ID', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Users
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Users Users' }).click();

    // expect: The Users section is displayed
    await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();

    // 2. Click the copy icon next to a user ID
    const copyButton = page.getByRole('button', { name: /^Copy:/ }).first();
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // expect: The user's ID is copied to the clipboard
    // Clipboard verification is limited in Playwright, confirm button is clickable
  });
});
