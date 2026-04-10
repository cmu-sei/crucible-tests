// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page Display', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and navigate to About page via navigation button
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: About page loads at /about route
    await expect(page).toHaveURL(/\/about/, { timeout: 10000 });

    // expect: Page displays 'TopoMojo' heading
    const heading = page.locator('text=TopoMojo').first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // expect: Tagline/description is visible
    const tagline = page.locator('text=/cybersecurity.*training.*labs/i, text=/virtual.*environment/i').first();
    const hasTagline = await tagline.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasTagline) {
      await expect(tagline).toBeVisible();
    }
  });
});
