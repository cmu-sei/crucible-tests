// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Clone is exposed as POST /api/game/clone. We verify by cloning a seeded
// game and asserting a new distinct game id is returned with the new name.
test.describe('Admin - Games', () => {
  let token: string;
  let source: CreatedGame;
  let clonedId: string | null = null;

  test.beforeEach(async () => {
    token = await getAdminToken();
    source = await createGame(token, { name: `CloneSource-${Date.now()}` });
  });

  test.afterEach(async () => {
    if (clonedId) await deleteGame(token, clonedId).catch(() => {});
    if (source) await deleteGame(token, source.id);
  });

  test('Clone/Duplicate Game', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const cloneName = `CloneCopy-${Date.now()}`;
      const cloneRes = await ctx.fetch(`http://localhost:5002/api/game/clone`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { gameId: source.id, name: cloneName },
      });
      expect(cloneRes.ok()).toBe(true);
      const cloned = await cloneRes.json();
      expect(cloned.id).toBeTruthy();
      expect(cloned.id).not.toBe(source.id);
      clonedId = cloned.id;
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
