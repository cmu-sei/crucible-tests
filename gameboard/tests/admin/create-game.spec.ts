// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import * as fs from 'fs';
import * as path from 'path';
import { test, expect, Services } from '../../fixtures';
import { getAdminToken, deleteGame, uploadGameCardImage, uploadGameMapImage } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Clicks the Admin → "New Game" button, which creates a draft game and
// opens the Game Center. We then upload card & map images to the new game
// so the test exercises the full new-game-with-imagery flow. Cleanup deletes
// the game in teardown.
test.describe('Admin - Games', () => {
  let token: string;
  let createdId: string | null = null;

  test.beforeEach(async () => {
    token = await getAdminToken();
  });

  test.afterEach(async () => {
    if (createdId) await deleteGame(token, createdId).catch(() => {});
  });

  test('Create New Game (with card and map imagery)', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const before = await ctx.fetch(`http://localhost:5002/api/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const beforeIds = new Set<string>(((await before.json()) as any[]).map(g => g.id));

      await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();

      await page.getByRole('button', { name: /New Game/i }).click();
      await page.waitForTimeout(3000);

      const after = await ctx.fetch(`http://localhost:5002/api/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const afterList = (await after.json()) as any[];
      const newGame = afterList.find(g => !beforeIds.has(g.id));
      expect(newGame, 'a new game should appear after clicking New Game').toBeTruthy();
      createdId = newGame!.id;
      expect(page.url()).not.toMatch(/\/admin\/dashboard\/?$/);

      // Upload the recommended-resolution card and map images.
      const cardBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/gameboard-card.png'));
      const mapBytes = fs.readFileSync(path.resolve(__dirname, '../../assets/gameboard-map.png'));
      await uploadGameCardImage(token, createdId, cardBytes, 'gameboard-card.png');
      await uploadGameMapImage(token, createdId, mapBytes, 'gameboard-map.png');

      // Confirm the game metadata reflects the uploaded imagery.
      const res = await ctx.fetch(`http://localhost:5002/api/game/${createdId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const withImages = await res.json();
      expect(withImages.logo, 'card image populates `logo`').toBeTruthy();
      expect(withImages.background, 'map image populates `background`').toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });
});
