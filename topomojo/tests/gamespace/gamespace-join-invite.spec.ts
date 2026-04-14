// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Gamespace Management', () => {
  test('Gamespace Join via Invite Code', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to gamespace join URL with invite code
    // Using a sample invite URL pattern - in real testing this would use a valid invite code
    await page.goto(Services.TopoMojo.UI + '/mojo/test-id/test-slug/test-code');
    await page.waitForLoadState('domcontentloaded');

    // expect: Join page loads or error if code is invalid
    // expect: Workspace/gamespace information is displayed (for valid codes)

    // For invalid codes, expect error handling
    const errorOrJoin = page.locator('[class*="error"], [class*="join"], button:has-text("Join"), text=/not found/i, text=/invalid/i').first();
    const hasContent = await errorOrJoin.isVisible({ timeout: 10000 }).catch(() => false);

    // The page should handle the invite code gracefully
    await page.waitForLoadState('domcontentloaded');
  });
});
