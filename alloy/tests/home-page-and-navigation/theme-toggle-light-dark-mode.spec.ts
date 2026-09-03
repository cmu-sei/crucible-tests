// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Home Page and Navigation', () => {
  test('Theme Toggle (Light/Dark Mode)', async ({ page }) => {
    // 1. Log in and navigate to the home page
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Application loads with default theme
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Locate and click the theme toggle button (in user menu)
    await page.getByRole('button', { name: 'Admin User' }).click();
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeVisible();

    // Click the Dark Theme toggle
    await page.getByRole('switch', { name: 'Dark Theme' }).click();

    // expect: The application theme switches to dark mode
    await expect(page.getByRole('switch', { name: 'Dark Theme' })).toBeChecked();

    // 3. Verify theme preference persists on page reload
    // Close the menu first by pressing Escape
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // Open user menu and check theme toggle state
    await page.getByRole('button', { name: 'Admin User' }).click();

    // Toggle back to light mode
    const darkThemeSwitch = page.getByRole('switch', { name: 'Dark Theme' });
    await darkThemeSwitch.click();

    // expect: The application theme switches back to light mode
    await expect(darkThemeSwitch).not.toBeChecked();
  });
});
