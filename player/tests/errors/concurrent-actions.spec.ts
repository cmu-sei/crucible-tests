// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('Concurrent User Actions - Race Conditions', async ({ playerAuthenticatedPage: page, browser }) => {
    // 1. Open two browser instances with same user logged in
    // First instance is already authenticated via fixture
    await expect(page.getByText('My Views')).toBeVisible();

    // Create a second context/page
    const context2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page2 = await context2.newPage();

    // Authenticate the second page
    await page2.goto(Services.Player.UI);
    await page2.getByText('Sign in to your account').first().waitFor({ state: 'visible', timeout: 70000 });
    await page2.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await page2.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page2.getByRole('button', { name: 'Sign In' }).click();
    await page2.waitForURL(/localhost:4301/, { timeout: 30000 });

    // expect: Both instances are authenticated
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page2.getByText('My Views')).toBeVisible();

    // 2. Perform actions in both instances
    // Both pages navigate to admin at the same time
    await Promise.all([
      page.getByRole('button', { name: 'Menu' }).click(),
      page2.getByRole('button', { name: 'Menu' }).click(),
    ]);

    // expect: Application handles concurrent access
    // expect: No data corruption occurs
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();
    await expect(page2.getByRole('menuitem', { name: 'Administration' })).toBeVisible();

    // Cleanup
    await context2.close();
  });
});
