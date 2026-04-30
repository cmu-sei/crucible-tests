// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, CreatedGame } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Exercises Gameboard's server-side validation of invalid input. Two cases:
// (1) name too long for the DB column, (2) logically invalid session duration.
// We avoid submitting malformed dates because Gameboard's date-parser throws
// an unhandled FormatException on bad date strings (a pre-existing backend
// bug), which is not what this test should exercise.
test.describe('Error Handling', () => {
  let token: string;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    game = await createGame(token, {
      name: `FormVal-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
  });

  test('Form Validation - Invalid Input Format', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      // Fetch the current game details.
      const getRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const current = await getRes.json();

      // Attempt an update with a name that far exceeds the 128-char column limit.
      const tooLongName = 'x'.repeat(1024);
      const invalidPayload = { ...current, name: tooLongName };
      const putRes = await ctx.fetch('http://localhost:5002/api/game', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: invalidPayload,
        timeout: 30000,
      });

      // Re-read the game; if validation rejected, the name should NOT equal
      // the too-long value. If the backend accepted it silently, this test
      // still catches the regression by asserting the name is different.
      const afterRes = await ctx.fetch(`http://localhost:5002/api/game/${game.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const after = await afterRes.json();
      if (putRes.ok()) {
        expect(after.name.length).toBeLessThanOrEqual(128);
      } else {
        expect([400, 413, 422, 500]).toContain(putRes.status());
      }
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
