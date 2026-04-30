// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Publish in Gameboard = toggle isPublished on the game (in Gear → Metadata
// in the UI, or PUT /api/game in the API). We verify by seeding an unpublished
// game, publishing it via API, and confirming the isPublished flag flips.
test.describe('Admin - Games', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    // Create unpublished.
    game = await createGame(token, { name: `PublishGame-${Date.now()}`, isPublished: false });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Publish Game - isPublished Toggles', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Fetch current state.
      const beforeRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const before = await beforeRes.json();
      expect(before.isPublished).toBe(false);

      // PUT with isPublished=true.
      const updated = { ...before, isPublished: true };
      const putRes = await ctx.fetch(`http://localhost:5002/api/game`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: updated,
      });
      expect(putRes.ok()).toBe(true);

      const afterRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const after = await afterRes.json();
      expect(after.isPublished).toBe(true);
    } finally {
      await ctx.dispose();
    }

    // UI sanity check — admin dashboard is reachable.
    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
