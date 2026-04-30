// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// The Admin → Live tab aggregates key metrics (Live Stats) across all
// activity. This is Gameboard's at-a-glance game statistics view.
test.describe('Admin - Reports', () => {
  test('View Game Statistics Dashboard', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/admin/overview', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live Stats' })).toBeVisible({ timeout: 15000 });

    // Expect the four KPI labels to be rendered.
    await expect(page.locator('text=Active Competitive Challenges').first()).toBeVisible();
    await expect(page.locator('text=Active Practice Challenges').first()).toBeVisible();
    await expect(page.locator('text=Active Competitive Teams').first()).toBeVisible();
    await expect(page.locator('text=Registered Users').first()).toBeVisible();
  });
});
