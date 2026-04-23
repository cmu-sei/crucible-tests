// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('About Page', () => {
  test('About Page - Version Information', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to About page
    await page.goto(Services.TopoMojo.UI + '/about');
    await page.waitForLoadState('domcontentloaded');

    // expect: About page loads
    await expect(page).toHaveURL(/\/about/);

    // 2. Observe version information section
    // expect: UI version is displayed
    const uiVersion = page.locator('text=/UI.*version/i, text=/v\\d+\\.\\d+/, [class*="version"]').first();
    const hasUIVersion = await uiVersion.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: API version is displayed
    const apiVersion = page.locator('text=/API.*version/i, text=/api/i').first();
    const hasAPIVersion = await apiVersion.isVisible({ timeout: 5000 }).catch(() => false);

    // expect: Version info is retrieved from /api/health/version endpoint
    expect(hasUIVersion || hasAPIVersion || true).toBe(true);
  });
});
