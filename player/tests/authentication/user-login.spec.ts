// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('User Login', async ({ page }) => {
    // 1. Navigate to the Player UI at http://localhost:4301
    await page.goto(Services.Player.UI);

    // expect: The application redirects to Keycloak login page
    await page.getByText('Sign in to your account').first().waitFor({ state: 'visible' });

    // expect: The page shows 'Sign in to your account' heading
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

    // expect: The page displays username and password fields
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Password' })).toBeVisible();

    // 2. Enter 'admin' as username
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');

    // expect: The username field accepts the input
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toHaveValue('admin');

    // 3. Enter 'admin' as password
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');

    // expect: The password field accepts the input and masks the characters
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue('admin');

    // 4. Click the 'Sign In' button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: The user is redirected back to Player UI
    await page.waitForURL(/localhost:4301/, { timeout: 30000 });

    // expect: The page displays 'My Views' section
    await expect(page.getByText('My Views')).toBeVisible();

    // expect: The page shows the user's name 'Admin User' in the menu button
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(page.getByText('Admin User').first()).toBeVisible();
  });
});
