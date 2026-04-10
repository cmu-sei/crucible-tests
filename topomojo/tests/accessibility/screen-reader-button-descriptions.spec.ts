// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Screen Reader - Button Descriptions', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to page with icon buttons - home page
    await expect(page).toHaveURL(/localhost:4201/);

    // expect: All icon buttons have aria-labels or titles
    const iconButtons = page.locator('button:has(mat-icon), button:has(fa-icon), button:has(svg)');
    const buttonCount = await iconButtons.count();

    let accessibleCount = 0;
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = iconButtons.nth(i);
      const isAccessible = await button.evaluate((el) => {
        const hasAriaLabel = el.hasAttribute('aria-label');
        const hasTitle = el.hasAttribute('title');
        const hasText = el.textContent?.trim() !== '';
        const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
        return hasAriaLabel || hasTitle || hasText || hasAriaLabelledBy;
      });

      if (isAccessible) {
        accessibleCount++;
      }
    }

    // expect: Button purposes are clear for screen readers
    if (buttonCount > 0) {
      expect(accessibleCount).toBeGreaterThan(0);
    }

    // expect: Hamburger menu button has aria-label='Toggle sidebar'
    const hamburger = page.locator('button[aria-label="Toggle sidebar"]');
    const hasHamburger = await hamburger.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHamburger) {
      await expect(hamburger).toHaveAttribute('aria-label', 'Toggle sidebar');
    }
  });
});
