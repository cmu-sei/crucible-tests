// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

// The theme is applied by AppComponent.setTheme as a `darkMode` class on <body>, and saved by
// UiDataService.setTheme as `selectedTheme` ('dark-theme' | 'light-theme') inside the JSON
// `uiState` entry in localStorage. Both are asserted directly rather than probing guessed keys.

const readIsDark = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.body.classList.contains('darkMode'));

const readSavedTheme = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('uiState') ?? '{}').selectedTheme ?? null;
    } catch {
      return null;
    }
  });

test.describe('Event Dashboard and Navigation', () => {
  test('Theme Toggle Light Dark Mode', async ({ blueprintAuthenticatedPage: page }) => {
    await expect(page).toHaveURL(serviceUrlPattern(Services.Blueprint.UI), { timeout: 30000 });
    await expect(page.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });

    const userMenuButton = page.getByRole('button', { name: 'Admin User' });
    const darkThemeToggle = page.getByRole('switch', { name: 'Dark Theme' });

    const initiallyDark = await readIsDark(page);

    // 1. Open the user menu and flip the Dark Theme switch.
    await userMenuButton.click();
    await expect(darkThemeToggle).toBeVisible({ timeout: 5000 });
    await darkThemeToggle.click();

    // expect: the body theme class flips.
    await expect
      .poll(() => readIsDark(page), { timeout: 15000, message: 'darkMode class should flip' })
      .toBe(!initiallyDark);

    // expect: the choice is saved in uiState.
    const expectedSaved = initiallyDark ? 'light-theme' : 'dark-theme';
    await expect.poll(() => readSavedTheme(page), { timeout: 5000 }).toBe(expectedSaved);

    // 2. Reload.
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.locator('app-root mat-toolbar').first()).toBeVisible({ timeout: 30000 });

    // expect: the toggled theme survives the reload.
    await expect
      .poll(() => readIsDark(page), { timeout: 15000, message: 'toggled theme should persist' })
      .toBe(!initiallyDark);

    // 3. Toggle back.
    await userMenuButton.click();
    await expect(darkThemeToggle).toBeVisible({ timeout: 5000 });
    await darkThemeToggle.click();

    // expect: the original theme is restored, and saved.
    await expect
      .poll(() => readIsDark(page), { timeout: 15000, message: 'toggling back should restore' })
      .toBe(initiallyDark);
    await expect
      .poll(() => readSavedTheme(page), { timeout: 5000 })
      .toBe(initiallyDark ? 'dark-theme' : 'light-theme');
  });
});
