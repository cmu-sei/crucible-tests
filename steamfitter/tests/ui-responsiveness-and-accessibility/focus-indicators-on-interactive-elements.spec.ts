// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('UI Responsiveness and Accessibility', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for focus indicator tests
  });

  test('Focus Indicators on Interactive Elements', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for content to load
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Tab through elements and check focus indicators
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Check the focused element has a visible focus indicator
    const firstFocusStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(firstFocusStyles).toBeTruthy();

    // Verify focus indicator is present (outline, border, or box-shadow)
    const hasFocusIndicator = (styles: any) => {
      if (!styles) return false;
      const hasOutline = styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px';
      const hasBoxShadow = styles.boxShadow !== 'none' && styles.boxShadow !== '';
      return hasOutline || hasBoxShadow;
    };

    // Tab to another element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    const secondFocusStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
      };
    });
    expect(secondFocusStyles).toBeTruthy();

    // Tab to a third element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    const thirdFocusStyles = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return {
        outline: style.outline,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        tagName: el.tagName,
      };
    });
    expect(thirdFocusStyles).toBeTruthy();

    // At least one of the focused elements should have a visible focus indicator
    const anyHasFocus = hasFocusIndicator(firstFocusStyles) ||
      hasFocusIndicator(secondFocusStyles) ||
      hasFocusIndicator(thirdFocusStyles);
    expect(anyHasFocus).toBe(true);
  });
});
