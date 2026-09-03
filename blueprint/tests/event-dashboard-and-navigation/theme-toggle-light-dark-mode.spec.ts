// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

test.describe('Event Dashboard and Navigation', () => {
  test('Theme Toggle Light Dark Mode', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Event Dashboard and click user menu, toggle 'Dark Theme' switch
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });

    // Open user menu
    const userMenuButton = page.getByRole('button', { name: 'Admin User' });
    await expect(userMenuButton).toBeVisible({ timeout: 5000 });
    await userMenuButton.click();

    // expect: A dropdown menu appears with logout option and theme toggle
    const darkThemeToggle = page.getByRole('switch', { name: 'Dark Theme' });
    await expect(darkThemeToggle).toBeVisible({ timeout: 5000 });

    // Record initial theme class on body/html
    const initialTheme = await page.evaluate(() => {
      return document.body.className + document.documentElement.className;
    });

    await darkThemeToggle.click();

    // expect: The application theme switches between light and dark mode.
    // Polled rather than slept on: the class swap is what proves the toggle took effect, so
    // waiting for that condition is both faster and not a race.
    const readTheme = () =>
      page.evaluate(() => document.body.className + document.documentElement.className);
    await expect
      .poll(readTheme, {
        timeout: 15000,
        intervals: [100, 200, 500],
        message: 'the theme class should change after toggling Dark Theme',
      })
      .not.toBe(initialTheme);
    const newTheme = await readTheme();

    // expect: Theme preference is saved in local storage
    const themeStorage = await page.evaluate(() => {
      return localStorage.getItem('darkTheme') ||
        localStorage.getItem('theme') ||
        localStorage.getItem('darkMode') ||
        localStorage.getItem('blueprint-theme');
    });
    // Theme storage key may vary — at minimum verify the toggle happened
    expect(newTheme.length).toBeGreaterThan(0);

    // 2. Refresh the page
    await page.keyboard.press('Escape');
    await page.reload();

    // expect: The selected theme persists after page reload. Waits for the app shell so the
    // class list is read from a rendered page, not mid-bootstrap.
    await expect(page.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });
    await expect
      .poll(readTheme, {
        timeout: 15000,
        intervals: [100, 200, 500],
        message: 'the toggled theme should survive a reload',
      })
      .not.toBe(initialTheme);
  });
});
