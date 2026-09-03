// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import {
  getAdminToken,
  createGame,
  deleteGame,
  createSponsor,
  deleteSponsor,
  setAdminSponsor,
  CreatedGame,
  CreatedSponsor,
} from '../../api-helpers';

// Gameboard uses the term "Enroll" (not "Register"). This test verifies that
// an Enroll button appears on the game details page. It requires the admin
// user to have a non-default sponsor — without one, the UI suppresses the
// Enroll button.
test.describe('Game Details and Registration', () => {
  let token: string;
  let game: CreatedGame;
  let sponsor: CreatedSponsor;
  let previousSponsorId = 'other';

  test.beforeEach(async () => {
    token = await getAdminToken();
    sponsor = await createSponsor(token);
    ({ previousSponsorId } = await setAdminSponsor(token, sponsor.id));
    game = await createGame(token, {
      name: `IndivReg-${Date.now()}`,
      maxTeamSize: 1,
      startOffsetDays: -1,
      endOffsetDays: 30,
    });
  });

  test.afterEach(async () => {
    if (game) await deleteGame(token, game.id);
    if (previousSponsorId && token) {
      await setAdminSponsor(token, previousSponsorId).catch(() => {});
    }
    if (sponsor) await deleteSponsor(token, sponsor.id);
  });

  test('Individual Registration - Enroll Button Visible', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'networkidle' });
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });

    // Enroll button is present in the Enrollment section.
    const enrollBtn = page.getByRole('button', { name: /^Enroll$/ });
    await expect(enrollBtn).toBeVisible({ timeout: 15000 });
    await expect(enrollBtn).toBeEnabled();
  });
});
