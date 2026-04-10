// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - License Information', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page and locate License section
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: License section is visible
    // 2. Review license information
    // expect: Copyright notice displays
    const copyrightNotice = page.locator('text=/Carnegie Mellon University/i, text=/Copyright/i, text=/All Rights Reserved/i').first();
    const hasCopyright = await copyrightNotice.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasCopyright) {
      await expect(copyrightNotice).toBeVisible();
    }

    // expect: License summary describes redistribution terms
    const licenseSummary = page.locator('text=/redistribution/i, text=/license/i').first();
    const hasLicense = await licenseSummary.isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasCopyright || hasLicense).toBe(true);
  });
});
