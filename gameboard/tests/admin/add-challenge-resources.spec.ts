// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import * as fs from 'fs';
import * as path from 'path';
import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken,
  createGame,
  deleteGame,
  uploadGameCardImage,
  uploadGameMapImage,
  CreatedGame,
} from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// In Gameboard, per-game "resources" are the card image, map image, and
// lobby/registration Markdown. TopoMojo hosts file downloads that attach to
// challenge specs — we cannot modify those from Gameboard. This test
// exercises the card + map image upload flow which is the Gameboard-side
// analog of "add challenge resources".
test.describe('Admin - Challenges', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, { name: `AddRes-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Add Challenge Resources - Upload Card & Map', async ({ gameboardAuthenticatedPage: page }) => {
    const cardPath = path.resolve(__dirname, '../../assets/gameboard-card.png');
    const mapPath = path.resolve(__dirname, '../../assets/gameboard-map.png');
    const cardBytes = fs.readFileSync(cardPath);
    const mapBytes = fs.readFileSync(mapPath);

    await uploadGameCardImage(token, game.id, cardBytes, 'gameboard-card.png');
    await uploadGameMapImage(token, game.id, mapBytes, 'gameboard-map.png');

    // Confirm the game's `logo` and `background` metadata were updated.
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = await res.json();
      expect(updated.logo, 'card image should populate logo field').toBeTruthy();
      expect(updated.background, 'map image should populate background field').toBeTruthy();
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
