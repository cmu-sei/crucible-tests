// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling', () => {
  test('Invalid Game ID Access', async ({ gameboardAuthenticatedPage: page }) => {
    const bogus = '00000000-0000-0000-0000-000000000000';
    await page.goto(`${Services.Gameboard.UI}/game/${bogus}`, { waitUntil: 'domcontentloaded' });

    // Gameboard shows a "Loading your game..." placeholder while it attempts to
    // resolve the game ID. After giving the client time to respond, the page
    // must either (a) still render the top-nav chrome without a JS crash, or
    // (b) redirect to an error or home view. Either is acceptable; the key
    // contract is "application does not crash".
    await page.waitForTimeout(8000);
    await expect(page.locator('a:has-text("Log out"), button:has-text("Log out")').first()).toBeVisible();

    // The bogus game id should not resolve into a playable game view — we do
    // NOT expect a functional challenge board to appear.
    const challengeBoard = page.locator('[class*="challenge-board"], [class*="game-board"]');
    expect(await challengeBoard.count()).toBe(0);
  });
});
