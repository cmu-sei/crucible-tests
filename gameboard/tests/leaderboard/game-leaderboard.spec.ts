// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Gameboard's per-game scoreboard is reachable at /game/{id} under the
// "Scoreboard" heading. For a game with no players, the scoreboard shows a
// "No one's scored in this game yet" message. The worker's read-only game has
// only the admin enrolled, with no score; the other leaderboard specs that seed
// scored players into it delete them again in their afterEach.
test.describe('Leaderboard', () => {
  test('Leaderboard Display - Game Scoreboard Section', async ({ gameboardAuthenticatedPage: page, readOnlyGame: game }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Scoreboard' })).toBeVisible({ timeout: 15000 });
    // With no players yet, Gameboard shows an informational placeholder.
    await expect(page.locator("text=/No one's scored/i").first()).toBeVisible();
  });
});
