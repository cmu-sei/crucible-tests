// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Game Discovery', () => {
  test('Home Page Display', async ({ gameboardAuthenticatedPage: page }) => {
    // 1. Log in and land on home page
    // expect: Home page displays with 'Gameboard' title
    await expect(page).toHaveURL(new RegExp(Services.Gameboard.UI), { timeout: 10000 });
    await expect(page).toHaveTitle(/Gameboard/i);

    // expect: Navigation menu is visible
    const nav = page.locator('nav, mat-toolbar, [role="navigation"], [role="banner"]').first();
    await expect(nav).toBeVisible();

    // expect: Main content area shows available games/competitions
    const mainContent = page.locator('main, [role="main"], .main-content, .content, app-root').first();
    await expect(mainContent).toBeVisible();
  });
});
