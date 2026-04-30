// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getAdminToken, createGame, deleteGame, createSponsor, deleteSponsor, CreatedGame, CreatedSponsor } from '../../api-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Exercises a report CSV export. Gameboard's ReportsExportController exposes
// endpoints under /api/reports/export/{name}. We verify the enrollment export
// returns a CSV body (or file-download response).
test.describe('Admin - Reports', () => {
  let token: string;
  let sponsor: CreatedSponsor;
  let game: CreatedGame;

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token, `ExpRep-${Date.now()}`);
    game = await createGame(token, {
      name: `ExpRep-${Date.now()}`,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Export Game Report', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(
        'http://localhost:5002/api/reports/export/enrollment',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(res.ok(), `status: ${res.status()}`).toBe(true);
      // Response is a FileContentResult — content-type for CSV / Excel.
      const contentType = res.headers()['content-type'] ?? '';
      expect(contentType).toMatch(/csv|octet-stream|text\/plain|spreadsheet/i);
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/reports', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({ timeout: 30000 });
  });
});
