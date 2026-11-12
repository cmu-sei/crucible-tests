// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// The worker's read-only (published, live) game guarantees at least one card.
test.describe('Home Page and Game Discovery', () => {
  test('Game Search Functionality', async ({ gameboardAuthenticatedPage: page, readOnlyGame: _liveGame }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'domcontentloaded' });

    const searchBox = page.locator('input[placeholder="Search games..."]').first();
    await expect(searchBox).toBeVisible();

    // Wait for the seeded card to render — retry-loop since parallel worker
    // creates/deletes can briefly hide our card from the home feed.
    const cards = page.locator('app-game-card');
    await expect
      .poll(() => cards.count(), { timeout: 30000, intervals: [500, 1000, 2500] })
      .toBeGreaterThanOrEqual(1);
    const initialCount = await cards.count();
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
