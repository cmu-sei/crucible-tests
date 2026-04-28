// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication and Authorization', () => {
  test('User Login Flow', async ({ page }) => {
    // 1. Navigate to http://localhost:4403
    await page.goto('http://localhost:4403');

    // expect: The application redirects to the Keycloak authentication page
    await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 30000 });

    // 2. Enter username 'admin' in the username field
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');

    // expect: The username field accepts input
    await expect(page.getByRole('textbox', { name: 'Username or email' })).toHaveValue('admin');

    // 3. Enter password 'admin' in the password field
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');

    // 4. Click the 'Sign In' button
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: The user is redirected back to http://localhost:4403
    await expect(page).toHaveURL(/localhost:4403/);

    // expect: The main application interface loads
    await expect(page.getByText('Alloy')).toBeVisible();

    // expect: The topbar displays the username 'admin'
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
  });
});
