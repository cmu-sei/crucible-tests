// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('Invalid Login Credentials', async ({ page }) => {
    // 1. Navigate to the Player UI
    await page.goto(Services.Player.UI);

    // expect: The application redirects to Keycloak login page
    await page.getByText('Sign in to your account').first().waitFor({ state: 'visible' });

    // 2. Enter 'invaliduser' as username and 'wrongpassword' as password
    await page.getByRole('textbox', { name: 'Username or email' }).fill('invaliduser');
    await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword');

    // expect: The credentials are entered in the fields
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toHaveValue('invaliduser');
    await expect(page.getByRole('textbox', { name: 'Password' })).toHaveValue('wrongpassword');

    // 3. Click the 'Sign In' button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: An error message is displayed
    const errorMessage = page.locator('.alert-error, #input-error, .kc-feedback-text');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // expect: User remains on the login page
    await expect(page).toHaveURL(/localhost:8443/, { timeout: 5000 });

    // expect: User is not authenticated
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toBeVisible();
  });
});
