// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: alloy/alloy-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateWithKeycloak, Services } from '../../../shared-fixtures';

test.describe('Authentication and Authorization', () => {
  test('Session Token Renewal', async ({ page }) => {
    // Collect console messages to check for token renewal
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    // 1. Log in as admin user
    await authenticateWithKeycloak(page, Services.Alloy.UI);

    // expect: Successfully authenticated
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();

    // 2. Wait for silent token renewal (check console logs for token refresh)
    // Reload the page to trigger a token check and verify session persists
    await page.reload();

    // expect: No user interaction is required for token renewal
    // expect: The user session remains active
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible({ timeout: 30000 });

    // expect: The application automatically renews the authentication token
    // Verify we are still on the app (not redirected to Keycloak)
    await expect(page).toHaveURL(/localhost:4403/);
  });
});
