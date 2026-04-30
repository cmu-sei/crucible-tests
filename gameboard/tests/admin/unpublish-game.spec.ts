// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

test.describe('Admin - Games', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, { name: `UnpubGame-${Date.now()}`, isPublished: true });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Unpublish Game - isPublished Toggles False', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const beforeRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const before = await beforeRes.json();
      expect(before.isPublished).toBe(true);

      const putRes = await ctx.fetch(`http://localhost:5002/api/game`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { ...before, isPublished: false },
      });
      expect(putRes.ok()).toBe(true);

      const afterRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const after = await afterRes.json();
      expect(after.isPublished).toBe(false);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
