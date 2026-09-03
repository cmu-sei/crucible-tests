// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Keyboard Navigation - Tab Order', async ({ gameboardAuthenticatedPage: page }) => {
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'networkidle' });
    // Ensure something is focusable.
    await page.locator('body').focus();

    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      const current = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return '';
        const tag = el.tagName.toLowerCase();
        const id = (el as HTMLElement).id || '';
        const cls = (el as HTMLElement).className?.toString().substring(0, 30) || '';
        return `${tag}#${id}.${cls}`;
      });
      if (current) seen.add(current);
    }
    // We should have focused at least 3 distinct interactive elements.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
