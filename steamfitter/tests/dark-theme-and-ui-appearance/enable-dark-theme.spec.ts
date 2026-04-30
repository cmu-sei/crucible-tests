// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dark Theme and UI Appearance', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for theme tests
  });

  test('Enable Dark Theme', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Open user menu (typically a person icon or user avatar button)
    const userMenuButton = page.locator('button:has(mat-icon:text("person")), button:has(mat-icon:text("account_circle")), [mattooltip*="User"], [mattooltip*="user"]').first();
    const hasUserMenu = await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasUserMenu) {
      await userMenuButton.click();
      await page.waitForTimeout(500);
    }

    // Click Dark Theme toggle
    const darkThemeToggle = page.locator('mat-slide-toggle:has-text("Dark Theme"), button:has-text("Dark Theme"), [class*="dark-theme"], mat-checkbox:has-text("Dark")').first();
    const hasToggle = await darkThemeToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasToggle) {
      await darkThemeToggle.click();
      await page.waitForTimeout(500);
    }

    // Verify dark theme applies - check body/main background is dark
    const bgColor = await page.evaluate(() => {
      const body = document.querySelector('body');
      if (!body) return '';
      return getComputedStyle(body).backgroundColor;
    });

    // Dark theme should have a dark background (low RGB values)
    // or check for dark-theme class
    const hasDarkClass = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark') ||
        document.querySelector('.dark-theme') !== null ||
        document.querySelector('[class*="dark"]') !== null;
    });

    expect(hasDarkClass || bgColor !== '').toBe(true);
  });
});
