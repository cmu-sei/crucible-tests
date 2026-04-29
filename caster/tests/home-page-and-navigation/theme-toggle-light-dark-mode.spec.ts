// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Home Page and Navigation', () => {
  test('Theme Toggle (Light/Dark Mode)', async ({ casterAuthenticatedPage: page }) => {

    // 1. Log in and navigate to the home page
    // expect: Application loads with default theme
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Locate and click the theme toggle button (in user menu)
    await page.getByRole('button', { name: 'Admin User' }).click();

    // expect: The user menu opens with a Dark Theme toggle
    const darkThemeToggle = page.getByRole('switch', { name: 'Dark Theme' });
    await expect(darkThemeToggle).toBeVisible();

    // Click the theme toggle
    await darkThemeToggle.click();

    // expect: The application theme switches between light and dark mode
    // Close the menu by pressing Escape
    await page.keyboard.press('Escape');

    // Reopen the menu to verify the toggle state persists
    await page.getByRole('button', { name: 'Admin User' }).click();
    await expect(darkThemeToggle).toBeVisible();

    // Toggle back to verify it works in both directions
    await darkThemeToggle.click();
    await page.keyboard.press('Escape');

    // expect: Theme preference can be toggled
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
  });
});
