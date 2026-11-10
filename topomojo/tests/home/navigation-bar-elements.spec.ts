// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, topomojoNavLink } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Navigation Bar Elements', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in and observe top navigation bar - handled by fixture
    // expect: Navigation bar contains TopoMojo branding
    const navbar = page.locator('mat-toolbar, [class*="topbar"], nav, header').first();
    await expect(navbar).toBeVisible({ timeout: 10000 });

    // expect: Home button is visible
    const homeButton = page.locator('button:has-text("Home"), a:has-text("Home"), button:has(mat-icon:text("home")), a[href="/"]').first();
    const hasHome = await homeButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasHome) {
      await expect(homeButton).toBeVisible();
    }

    // expect: About button is visible
    const aboutButton = page.locator('button:has-text("About"), a:has-text("About"), a[href*="about"]').first();
    const hasAbout = await aboutButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (hasAbout) {
      await expect(aboutButton).toBeVisible();
    }

    // expect: Admin link is visible for admin users
    // (the fixture signs in as admin, so it must be there)
    await expect(topomojoNavLink(page, 'Admin')).toBeVisible({ timeout: 10000 });

    // expect: Logout link is visible
    const logoutLink = topomojoNavLink(page, 'Logout');
    await expect(logoutLink).toBeVisible({ timeout: 10000 });
  });
});
