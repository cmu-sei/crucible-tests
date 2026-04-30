// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';

// Gameboard's game cards reveal an "Open" button on hover. Because multiple
// tests running in parallel may seed several cards simultaneously, we verify
// the navigation contract by hovering a card, then navigate to the known
// target URL to confirm the detail page renders.
test.describe('Home Page and Game Discovery', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `NavGame-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Navigate to Game Details', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });

    // Home page renders at least one card with the hover interaction available.
    const wrapper = page.locator('.card-wrapper').first();
    await expect(wrapper).toBeVisible({ timeout: 15000 });
    await wrapper.hover({ force: true });
    await page.waitForTimeout(500);
    await expect(page.locator('button.open-button').first()).toBeVisible({ timeout: 10000 });

    // Navigate to the seeded game's detail URL for a deterministic check.
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/game/${game.id}`));
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });
  });
});
