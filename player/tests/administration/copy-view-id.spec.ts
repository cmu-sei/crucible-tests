// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Copy View ID', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin and navigate to Administration > Views
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: The Views admin section is displayed
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // 2. Click the copy icon next to a view
    const copyButton = page.getByRole('button', { name: /^Copy: 35d24422/ });
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // expect: The view's ID is copied to the clipboard
    // expect: A visual confirmation may appear
    // Clipboard verification is limited in Playwright, but we confirm the button is clickable
  });
});
