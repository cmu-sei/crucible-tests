// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('API Error Handling - Network Failure', async ({ gameboardAuthenticatedPage: page }) => {
    // Block all Gameboard API calls and verify the app does not crash.
    await page.route(Services.Gameboard.API + '/**', (route) => route.abort('failed'));

    await page.goto(Services.Gameboard.UI + '/admin/overview', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    // Even with API calls blocked, the SPA chrome (topbar, admin nav) should still render.
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible({ timeout: 15000 });
    // The app should not have crashed into a blank/white screen — the Log out link remains visible.
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();
  });
});
