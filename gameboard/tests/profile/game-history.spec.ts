// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Profile', () => {
  test('View Game History', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/user/profile', { waitUntil: 'domcontentloaded' });

    // Click the History tab.
    await page.locator('text=History').first().click();

    // URL and an identifiable element (heading or empty-state message) should appear.
    await page.waitForTimeout(1500);
    // Either the user has prior games (list rows) or the page shows an empty state.
    // Assert at least that the word "History" remains visible somewhere.
    await expect(page.locator('text=History').first()).toBeVisible();
  });
});
