// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Responsive Design - Tablet View', async ({ gameboardAuthenticatedPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The home heading remains visible on tablet layouts.
    await expect(page.getByRole('heading', { name: 'Upcoming Games' })).toBeVisible({ timeout: 10000 });
    // Allow small scrollbar/rendering slack. Gameboard's current Bootstrap grid
    // can produce a few px of horizontal overflow at this exact breakpoint.
    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(20);
  });
});
