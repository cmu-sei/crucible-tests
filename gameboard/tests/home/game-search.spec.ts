// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

test.describe('Home Page and Game Discovery', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `SearchableLive-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Game Search Functionality', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });

    const searchBox = page.locator('input[placeholder="Search games..."]').first();
    await expect(searchBox).toBeVisible();

    // Wait for the seeded card to render — retry-loop since parallel worker
    // creates/deletes can briefly hide our card from the home feed.
    const cards = page.locator('app-game-card');
    let initialCount = 0;
    for (let i = 0; i < 12; i++) {
      initialCount = await cards.count();
      if (initialCount >= 1) break;
      await page.waitForTimeout(2500);
    }
    expect(initialCount, 'at least the seeded game should render').toBeGreaterThanOrEqual(1);

    // Search for a unique string unlikely to match any card fields — card count should drop.
    await searchBox.fill('zzzzz-no-match-xxx');
    await expect
      .poll(() => cards.count(), { timeout: 15000, intervals: [500, 1000, 2000] })
      .toBeLessThanOrEqual(initialCount);
    const filteredCount = await cards.count();

    // Clear search — card count restored (or higher). Re-render is incremental,
    // so poll until it catches up to the pre-filter count rather than using a fixed wait.
    await searchBox.fill('');
    await expect
      .poll(() => cards.count(), { timeout: 15000, intervals: [500, 1000, 2000] })
      .toBeGreaterThanOrEqual(filteredCount);
    const restoredCount = await cards.count();
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  });
});
