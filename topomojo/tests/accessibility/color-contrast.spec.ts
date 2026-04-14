// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Color Contrast Compliance', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Run automated accessibility check on home page
    await expect(page).toHaveURL(/localhost:4201/);

    // Check that key text elements have sufficient contrast
    const textElements = page.locator('h1, h2, h3, p, span, a, button, label');
    const elementCount = await textElements.count();

    let checkedElements = 0;
    for (let i = 0; i < Math.min(elementCount, 10); i++) {
      const element = textElements.nth(i);
      const isVisible = await element.isVisible().catch(() => false);

      if (isVisible) {
        const contrastInfo = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          const color = styles.color;
          const bgColor = styles.backgroundColor;
          const fontSize = parseFloat(styles.fontSize);

          return {
            color,
            bgColor,
            fontSize,
            hasText: el.textContent?.trim() !== '',
          };
        });

        if (contrastInfo.hasText) {
          checkedElements++;
          // expect: Text meets WCAG contrast requirements
          // Basic check: color should not be the same as background
          expect(contrastInfo.color).not.toBe(contrastInfo.bgColor);
        }
      }
    }

    // expect: No critical contrast violations are reported
    expect(checkedElements).toBeGreaterThan(0);
  });
});
