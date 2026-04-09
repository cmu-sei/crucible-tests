// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Redirect', async ({ page }) => {
    // 1. Clear all browser cookies (storage is already empty in fresh context)
    await page.context().clearCookies();

    // 2. Navigate to http://localhost:4725
    await page.goto('http://localhost:4725');

    // expect: The application redirects to the Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*/, { timeout: 70000 });

    // expect: No application content is displayed before authentication
    const blueprintContent = page.locator('text=Event Dashboard');
    await expect(blueprintContent).not.toBeVisible();

    // Verify Keycloak login form is displayed
    const usernameField = page.locator('input[name="username"]');
    const passwordField = page.locator('input[name="password"]');
    await expect(usernameField).toBeVisible();
    await expect(passwordField).toBeVisible();
  });
});
