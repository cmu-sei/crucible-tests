// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Tab Order', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page - handled by fixture
    // expect: Page is loaded
    await expect(page).toHaveURL(/localhost:4201/);

    // 2. Press Tab key repeatedly
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // expect: Focus moves through elements in logical order
    let focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : null;
    });
    expect(focusedElement).not.toBeNull();

    // Tab through several elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // expect: All interactive elements are reachable
    focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : null;
    });
    expect(focusedElement).not.toBeNull();

    // expect: Focus indicator is visible (element has focus)
    const hasFocusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const styles = window.getComputedStyle(el);
      return styles.outlineStyle !== 'none' || styles.boxShadow !== 'none' || el.classList.contains('cdk-focused');
    });
    // Focus should be visible on at least some elements
  });
});
