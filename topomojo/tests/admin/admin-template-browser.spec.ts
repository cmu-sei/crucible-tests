// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Admin Panel', () => {
  test('Admin - Template Browser', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Wait for authenticated page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Handle authentication if needed - the fixture may detect app content before auth completes
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    const isLoginVisible = await loginButton.isVisible().catch(() => false);

    if (isLoginVisible) {
      // Need to complete authentication
      await loginButton.click();
      await page.waitForLoadState('domcontentloaded');

      // Fill in Keycloak login form
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin');
      await page.click('button:has-text("Sign In")');

      // Wait for redirect back to TopoMojo
      await page.waitForURL('http://localhost:4201/**', { timeout: 30000 });
      await page.waitForLoadState('domcontentloaded');
    }

    // Wait for Admin button to be visible (confirms authentication)
    const adminButton = page.getByRole('button', { name: 'Admin' });
    await expect(adminButton).toBeVisible({ timeout: 10000 });

    // 2. Navigate to admin panel
    await adminButton.click();
    await page.waitForLoadState('domcontentloaded');

    // 3. Click on 'Templates' link in admin navigation
    const templateLink = page.getByRole('link', { name: 'Templates' });
    await expect(templateLink).toBeVisible({ timeout: 5000 });
    await templateLink.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Admin template browser loads
    await expect(page).toHaveURL(/\/admin\/templates/);

    // expect: Templates heading is visible
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();

    // expect: Template browser header is visible (always present, even with empty list)
    const templateHeader = page.locator('.workspace-header').first();
    await expect(templateHeader).toBeVisible({ timeout: 10000 });

    // expect: If templates exist, the favorite button is visible (graceful check for empty state)
    const favoriteButtons = page.getByRole('button', { name: 'Favorite template' });
    const favoriteCount = await favoriteButtons.count();
    if (favoriteCount > 0) {
      await expect(favoriteButtons.first()).toBeVisible();
    }
  });
});
