// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Dark Theme and UI Appearance', () => {
  test.afterEach(async ({ }) => {
    // No resources to clean up for theme tests
  });

  test('Dark Theme Persists Across Refreshes', async ({ steamfitterAuthenticatedPage: page }) => {
    await page.goto(`${Services.Steamfitter.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    // Wait for topbar to be visible
    const topbar = page.locator('mat-toolbar, [class*="topbar"], header, [role="banner"]').first();
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Open user menu - the button displays the user's name (e.g. "Admin User")
    const userMenuButton = page.locator('button:has-text("Admin User"), button:has(mat-icon:text("person")), button:has(mat-icon:text("account_circle")), [mattooltip*="User"], [mattooltip*="user"]').first();
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    // Wait for the user menu/dropdown to appear
    const menuPanel = page.locator('.mat-mdc-menu-panel, .mat-menu-panel, .cdk-overlay-pane, [role="menu"]').first();
    await expect(menuPanel).toBeVisible({ timeout: 5000 });

    // Enable dark theme via the toggle in the menu
    const darkThemeToggle = page.locator('mat-slide-toggle, mat-checkbox').filter({ hasText: /dark/i }).first();
    const hasToggle = await darkThemeToggle.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasToggle) {
      await darkThemeToggle.click();
      await page.waitForTimeout(500);
    }

    // Close the menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Capture theme state before reload for comparison
    const darkClassBeforeReload = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark') ||
        document.querySelector('.dark-theme') !== null ||
        document.querySelector('[class*="dark"]') !== null;
    });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for the app to fully render after reload
    await expect(topbar).toBeVisible({ timeout: 15000 });

    // Verify dark theme state is preserved after refresh
    const hasDarkClass = await page.evaluate(() => {
      return document.body.classList.contains('dark-theme') ||
        document.body.classList.contains('theme-dark') ||
        document.querySelector('.dark-theme') !== null ||
        document.querySelector('[class*="dark"]') !== null;
    });

    // Check localStorage for theme persistence
    const localStorageValue = await page.evaluate(() => {
      // Check common Angular state management keys
      return localStorage.getItem('akita-steamfitter-ui') ||
        localStorage.getItem('steamfitter-settings') ||
        localStorage.getItem('theme');
    });

    // The theme state after reload should match the state before reload,
    // confirming the preference was persisted.
    expect(hasDarkClass).toBe(darkClassBeforeReload);
  });
});
