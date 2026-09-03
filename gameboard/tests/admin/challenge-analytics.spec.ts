// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin - Reports', () => {
  test('View Challenge Performance Analytics', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible({ timeout: 30000 });

    // Click the Challenges report card (the first link with this text in the report grid).
    const challengesReport = page.locator('a[href="/reports/challenges"]').first();
    await challengesReport.click();
    await page.waitForLoadState('domcontentloaded');

    // Challenges report page should show relevant filter/field headings.
    await expect(page).toHaveURL(/\/reports\/challenges/);
    // At minimum the page renders the report heading or fields section.
    const pageIdentifier = page.locator('h1, h2, h3').filter({ hasText: /Challenges|Fields|Filters/i }).first();
    await expect(pageIdentifier).toBeVisible({ timeout: 15000 });
  });
});
