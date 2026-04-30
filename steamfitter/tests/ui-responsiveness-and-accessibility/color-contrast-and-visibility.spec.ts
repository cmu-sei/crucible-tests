// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for contrast tests
  });

  test('Color Contrast and Visibility', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Verify topbar has #BB0000 background color
    const topbarBg = await topbar.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.backgroundColor;
    });
    // #BB0000 in RGB is rgb(187, 0, 0)
    expect(topbarBg).toMatch(/rgb\(187,\s*0,\s*0\)/);

    // Verify topbar text is white
    const topbarColor = await topbar.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.color;
    });
    // White in RGB is rgb(255, 255, 255)
    expect(topbarColor).toMatch(/rgb\(255,\s*255,\s*255\)/);

    // Check contrast ratio meets WCAG 4.5:1 minimum
    // #BB0000 (187, 0, 0) vs white (255, 255, 255)
    const contrastRatio = await page.evaluate(() => {
      function getLuminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
          c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
        );
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      const bgLuminance = getLuminance(187, 0, 0);
      const textLuminance = getLuminance(255, 255, 255);
      const lighter = Math.max(bgLuminance, textLuminance);
      const darker = Math.min(bgLuminance, textLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    });

    // WCAG AA requires at least 4.5:1 for normal text
    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
  });
});
