// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken, createGame, deleteGame, createSponsor, deleteSponsor,
  setAdminSponsor, enrollAdmin, deletePlayer,
  addChallengeSpecToGame, deleteChallengeSpec,
  CreatedGame, CreatedSponsor,
} from '../../api-helpers';
import { getTopoMojoAdminToken, createWorkspace, deleteWorkspace, CreatedWorkspace } from '../../../topomojo-helpers';
import { gbConnect, seedChallenge } from '../../db-helpers';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

// Gameboard does not have explicit "category" filters, but challenges can be
// tagged. We seed two challenge-specs with distinct tags and verify listing
// returns both and they are tag-differentiated.
test.describe('Challenges', () => {
  let gbToken: string, tmToken: string;
  let sponsor: CreatedSponsor, game: CreatedGame;
  let ws1: CreatedWorkspace, ws2: CreatedWorkspace;
  let spec1: string, spec2: string, playerId: string, teamId: string;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    gbToken = await getAdminToken();
    tmToken = await getTopoMojoAdminToken();
    sponsor = await createSponsor(gbToken, `Cat-${Date.now()}`);
    ({ previousSponsorId } = await setAdminSponsor(gbToken, sponsor.id));
    ws1 = await createWorkspace(tmToken, { name: `Cat-A-${Date.now()}`, audience: 'gameboard' });
    ws2 = await createWorkspace(tmToken, { name: `Cat-B-${Date.now()}`, audience: 'gameboard' });
    game = await createGame(gbToken, { name: `Cat-${Date.now()}`, startOffsetDays: -1, endOffsetDays: 30 });
    const s1 = await addChallengeSpecToGame(gbToken, game.id, { externalId: ws1.id, name: 'Alpha Web' });
    const s2 = await addChallengeSpecToGame(gbToken, game.id, { externalId: ws2.id, name: 'Beta Crypto' });
    spec1 = s1.id; spec2 = s2.id;
    const player = await enrollAdmin(gbToken, game.id);
    playerId = player.id; teamId = player.teamId;

    const client = await gbConnect();
    try {
      await seedChallenge(client, { gameId: game.id, specId: spec1, playerId, teamId, externalId: ws1.id, name: 'Alpha Web', points: 100 });
      await seedChallenge(client, { gameId: game.id, specId: spec2, playerId, teamId, externalId: ws2.id, name: 'Beta Crypto', points: 200 });
    } finally {
      await client.end();
    }
  });

  test.afterEach(async () => {
    if (playerId) await deletePlayer(gbToken, playerId).catch(() => {});
    if (spec1) await deleteChallengeSpec(gbToken, spec1).catch(() => {});
    if (spec2) await deleteChallengeSpec(gbToken, spec2).catch(() => {});
    if (game) await deleteGame(gbToken, game.id);
    if (ws1) await deleteWorkspace(tmToken, ws1.id);
    if (ws2) await deleteWorkspace(tmToken, ws2.id);
    if (previousSponsorId) await setAdminSponsor(gbToken, previousSponsorId).catch(() => {});
    if (sponsor) await deleteSponsor(gbToken, sponsor.id);
  });

  test('Challenge Filtering - By Category (via Tag)', async ({ gameboardAuthenticatedPage: page }) => {
    const ctx: APIRequestContext = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const res = await ctx.fetch(`http://localhost:5002/api/challenges?gid=${game.id}`, {
        headers: { Authorization: `Bearer ${gbToken}` },
      });
      const all: any[] = await res.json();
      // /api/challenges doesn't filter by gid server-side and ChallengeSummary
      // exposes gameName rather than gameId — narrow by unique game name.
      const list = all.filter(c => c.gameName === game.name);
      expect(list.length).toBeGreaterThanOrEqual(2);
      const tags = list.map(c => c.tag);
      // Tags are derived from the challenge name.
      expect(tags).toContain('alpha-web');
      expect(tags).toContain('beta-crypto');
    } finally {
      await ctx.dispose();
    }

    await page.goto(Services.Gameboard.UI + '/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
