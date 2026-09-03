// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Accessibility', () => {
  test('Responsive Design - Mobile View', async ({ gameboardAuthenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(Services.Gameboard.UI + '/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The responsive Menu toggle button (#nav-toggle) should be visible on mobile.
    const menuToggle = page.locator('#nav-toggle');
    await expect(menuToggle.first()).toBeVisible({ timeout: 10000 });

    // Content should remain readable — heading stays visible on mobile.
    await expect(page.getByRole('heading', { name: 'Upcoming Games' })).toBeVisible({ timeout: 10000 });
  });
});
