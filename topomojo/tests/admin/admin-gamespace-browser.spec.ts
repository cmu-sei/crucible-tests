// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, topomojoNavLink } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Gamespace Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Navigate to home page
    await page.goto(Services.TopoMojo.UI);
    await page.waitForLoadState('domcontentloaded');

    // 2. Wait for Admin link to confirm authentication (fixture already authenticated)
    // The Admin link only appears after auth state is set - wait generously to avoid race conditions
    const adminLink = topomojoNavLink(page, 'Admin');

    try {
      await adminLink.waitFor({ state: 'visible', timeout: 30000 });
    } catch (error) {
      throw new Error(`Admin link did not appear within 30 seconds. Current URL: ${page.url()}`);
    }

    // 3. Click on 'Admin' link in navigation
    await adminLink.click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // 4. Click on 'Gamespaces' link in admin navigation
    const gamespaceLink = page.getByRole('link', { name: 'Gamespaces' });
    await gamespaceLink.click();
    await page.waitForURL(/\/admin\/gamespaces/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin gamespace browser loads
    // expect: Gamespace management interface is visible
    const gamespaceHeading = page.getByRole('heading', { name: 'Gamespaces', level: 4 });
    await expect(gamespaceHeading).toBeVisible({ timeout: 10000 });

    // expect: Search controls are visible
    const searchBox = page.getByRole('searchbox', { name: /search gamespaces/i });
    await expect(searchBox).toBeVisible({ timeout: 10000 });
  });
});
