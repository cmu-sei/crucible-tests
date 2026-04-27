// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('Failed Authentication - Empty Credentials', async ({ page }) => {
    // 1. Navigate to Player UI at http://localhost:4301
    await page.goto(Services.Player.UI);

    // expect: User is redirected to Keycloak login page
    await page.getByText('Sign in to your account').first().waitFor({ state: 'visible' });

    // 2. Leave username field empty
    const usernameField = page.getByRole('textbox', { name: 'Username or email' });

    // expect: Username field is empty
    await expect(usernameField).toHaveValue('');

    // 3. Leave password field empty
    const passwordField = page.getByRole('textbox', { name: 'Password' });

    // expect: Password field is empty
    await expect(passwordField).toHaveValue('');

    // 4. Click the 'Sign In' button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: Validation error appears
    // expect: Error message indicates required fields
    const errorMessage = page.locator('.alert-error, #input-error, .kc-feedback-text');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });

    // expect: User cannot proceed without credentials
    await expect(page).toHaveURL(/localhost:8443/, { timeout: 5000 });
  });
});
