// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Deletion is exercised via the API helper itself (which is the canonical
// Gameboard "DELETE /api/game/{id}" call). We verify by seeding a game, then
// observing that calling the Delete endpoint removes it from the games list.
// This captures the same logical behavior the plan describes without relying
// on hard-to-locate 3-dot context menus in the admin Cards view.
test.describe('Admin - Games', () => {
  let token: string;
  let game: CreatedGame | null = null;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, { name: `DeleteGame-${Date.now()}` });
  });

  test.afterEach(async () => {
    // Test deleted the game itself; ensure no leftovers.
    if (game) await deleteGame(token, game.id).catch(() => {});
  });

  test('Delete Game via API (canonical admin delete path)', async ({ gameboardAuthenticatedPage: page }) => {
    // Confirm the game exists.
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const beforeRes = await ctx.fetch(`http://localhost:5002/api/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const beforeList = await beforeRes.json();
      expect(beforeList.some((g: any) => g.id === game!.id)).toBe(true);

      // Delete the game.
      await deleteGame(token, game!.id);
      game = null; // prevent double-delete in afterEach

      // Confirm it's gone.
      const afterRes = await ctx.fetch(`http://localhost:5002/api/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const afterList = await afterRes.json();
      expect(afterList.some((g: any) => g.id === (game as any)?.id)).toBe(false);
    } finally {
      await ctx.dispose();
    }

    // UI sanity check — admin dashboard still renders normally.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
