// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Theme Toggle (Light/Dark Mode)', async ({ blueprintAuthenticatedPage: page }) => {

    // expect: Application loads with default theme
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('domcontentloaded');

    // Get initial theme - theme is applied as "darkMode" class on document.body
    // Light mode: body.className === ""
    // Dark mode:  body.className === "darkMode"
    const initialTheme = await page.evaluate(() => {
      return document.body.className;
    });

    // 2. Open the user menu (Admin User button) to access the Dark Theme toggle
    const userMenuButton = page.getByRole('button', { name: /Admin User/i });
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    // 3. Locate and click the Dark Theme switch inside the user menu
    const themeToggle = page.getByRole('switch', { name: /dark theme/i });
    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    await themeToggle.click();

    // expect: The application theme switches between light and dark mode
    await page.waitForTimeout(500); // Allow theme transition

    const newTheme = await page.evaluate(() => {
      return document.body.className;
    });
    expect(newTheme).not.toBe(initialTheme);

    // expect: Dark theme adds "darkMode" class to body
    // expect: Light theme has no theme class on body
    const isDarkMode = newTheme.toLowerCase().includes('dark');

    // expect: All components properly render in the new theme
    const topbar = page.locator('[class*="topbar"], [class*="top-bar"], [class*="header"]').first();
    await expect(topbar).toBeVisible();

    const mainContent = page.locator('main, [class*="content"]').first();
    await expect(mainContent).toBeVisible();

    // expect: Theme preference is saved in local storage
    // Theme is stored in "uiState" JSON as selectedTheme ("dark-theme" or "light-theme")
    const themePreference = await page.evaluate(() => {
      const uiState = localStorage.getItem('uiState');
      if (uiState) {
        try {
          const parsed = JSON.parse(uiState);
          return parsed.selectedTheme || null;
        } catch {
          return null;
        }
      }
      return null;
    });
    expect(themePreference).toBeTruthy();

    // expect: Overlay components (dialogs, dropdowns) also reflect the theme change
    // Toggle theme back to verify it works both ways
    // Re-open user menu since clicking elsewhere may have closed it
    const isMenuOpen = await page.getByRole('switch', { name: /dark theme/i }).isVisible();
    if (!isMenuOpen) {
      await userMenuButton.click();
    }
    await themeToggle.click();
    await page.waitForTimeout(500);

    const revertedTheme = await page.evaluate(() => {
      return document.body.className;
    });
    expect(revertedTheme).toBe(initialTheme);

    // 3. Refresh the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // expect: The selected theme persists after page reload
    const themeAfterReload = await page.evaluate(() => {
      return document.body.className;
    });
    expect(themeAfterReload).toBe(initialTheme);
  });
});
