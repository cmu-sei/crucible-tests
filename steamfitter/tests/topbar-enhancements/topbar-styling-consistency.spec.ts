// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Topbar Enhancements', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for topbar styling tests
  });

  test('Topbar Styling Consistency', async ({ steamfitterAuthenticatedPage: page }) => {
    // Navigate to Home
    await page.goto(`${Services.Steamfitter.UI}`);
    await page.waitForLoadState('domcontentloaded');

    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Check topbar styling on Home page
    const homeTopbarBg = await topbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const homeTopbarColor = await topbar.evaluate((el) => getComputedStyle(el).color);
    const homeTitle = await topbar.textContent();

    // Verify background is #BB0000 (rgb(187, 0, 0))
    expect(homeTopbarBg).toMatch(/rgb\(187,\s*0,\s*0\)/);
    // Verify text is white (rgb(255, 255, 255))
    expect(homeTopbarColor).toMatch(/rgb\(255,\s*255,\s*255\)/);
    // Verify title is visible
    expect(homeTitle).toContain('Steamfitter');

    // Navigate to Admin
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const adminTopbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(adminTopbar).toBeVisible({ timeout: 15000 });

    // Check topbar styling on Admin page
    const adminTopbarBg = await adminTopbar.evaluate((el) => getComputedStyle(el).backgroundColor);
    const adminTopbarColor = await adminTopbar.evaluate((el) => getComputedStyle(el).color);
    const adminTitle = await adminTopbar.textContent();

    // Verify consistency between Home and Admin topbar styling
    expect(adminTopbarBg).toBe(homeTopbarBg);
    expect(adminTopbarColor).toBe(homeTopbarColor);
    expect(adminTitle).toContain('Steamfitter');
  });
});
