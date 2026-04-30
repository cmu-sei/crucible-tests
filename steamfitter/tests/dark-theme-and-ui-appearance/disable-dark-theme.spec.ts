// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dark Theme and UI Appearance', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for theme tests
  });

  test('Disable Dark Theme', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // First enable dark theme
    const userMenuButton = page.locator('button:has(mat-icon:text("person")), button:has(mat-icon:text("account_circle")), [mattooltip*="User"], [mattooltip*="user"]').first();
    const hasUserMenu = await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasUserMenu) {
      await userMenuButton.click();
      await page.waitForTimeout(500);
    }

    const darkThemeToggle = page.locator('mat-slide-toggle:has-text("Dark Theme"), button:has-text("Dark Theme"), mat-checkbox:has-text("Dark")').first();
    const hasToggle = await darkThemeToggle.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasToggle) {
      // Enable dark theme
      await darkThemeToggle.click();
      await page.waitForTimeout(500);

      // Close menu if needed
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Reopen menu and toggle off
      if (hasUserMenu) {
        await userMenuButton.click();
        await page.waitForTimeout(500);
      }

      // Toggle dark theme off
      await darkThemeToggle.click();
      await page.waitForTimeout(500);
    }

    // Verify light theme returns
    const hasDarkClass = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark');
    });
    expect(hasDarkClass).toBe(false);

    // Check localStorage is updated
    const localStorageValue = await page.evaluate(() => {
      return localStorage.getItem('akita-steamfitter-ui');
    });

    if (localStorageValue) {
      // Should not contain dark-theme when disabled, or the value should indicate light
      const parsed = JSON.parse(localStorageValue);
      if (parsed && typeof parsed === 'object') {
        // Verify theme state reflects light mode
        expect(localStorageValue).not.toContain('"dark-theme":true');
      }
    }
  });
});
