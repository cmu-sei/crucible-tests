// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Home Page - My Views', () => {
  test('Dark Theme Toggle', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in as admin user
    // expect: User is on the home page
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Click the Menu button
    await page.getByRole('button', { name: 'Menu' }).click();

    // expect: A dropdown menu appears showing a 'Dark Theme' toggle switch
    const darkThemeSwitch = page.getByRole('switch', { name: 'Dark Theme' });
    await expect(darkThemeSwitch).toBeVisible();

    // 3. Toggle the Dark Theme switch
    await page.getByText('Dark Theme').click();

    // expect: The application theme changes to dark mode
    // expect: Colors and backgrounds update to dark theme
    // Close the menu first
    await page.keyboard.press('Escape');

    // 4. Toggle the Dark Theme switch again
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByText('Dark Theme').click();

    // expect: The application theme changes back to light mode
    await page.keyboard.press('Escape');
    await expect(page.getByText('My Views')).toBeVisible();
  });
});
