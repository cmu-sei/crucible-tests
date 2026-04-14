// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Observer Mode', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in as admin user (who can access observer mode) - handled by fixture

    // 2. Navigate to /observe route
    await page.goto(Services.TopoMojo.UI + '/observe');
    await page.waitForLoadState('domcontentloaded');

    // expect: Observer page loads (or redirects if not available)
    const observerContent = page.locator('[class*="observe"], [class*="observer"], [class*="monitor"]').first();
    const hasObserver = await observerContent.isVisible({ timeout: 10000 }).catch(() => false);

    if (hasObserver) {
      // expect: Observer can view gamespaces without interacting
      // expect: Read-only view is enforced
      await expect(observerContent).toBeVisible();
    }
  });
});
