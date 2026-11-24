// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Views the worker's read-only game; nothing here registers or edits it.
test.describe('Game Details and Registration', () => {
  test('Game Details Page Display', async ({ gameboardAuthenticatedPage: page, readOnlyGame: game }) => {
    await page.goto(`${Services.Gameboard.UI}/game/${game.id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`text=${game.name}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Enrollment' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Info' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scoreboard' })).toBeVisible();
  });
});
