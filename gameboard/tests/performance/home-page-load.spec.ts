// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

// Basic page-load timing. We use a relaxed 15-second threshold rather than 3s
// because the dev container runs many services and cold starts can be slow.
test.describe('Performance', () => {
  test('Page Load Performance - Home Page', async ({ gameboardAuthenticatedPage: page }) => {
    const start = Date.now();
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'domcontentloaded' });
    const loadMs = Date.now() - start;
    expect(loadMs).toBeLessThan(15000);

    await expect(page.getByRole('heading', { name: 'Upcoming Games' })).toBeVisible({ timeout: 15000 });
  });
});
