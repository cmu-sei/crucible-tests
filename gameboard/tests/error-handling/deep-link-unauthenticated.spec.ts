// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gameboard/gameboard-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Error Handling', () => {
  test('Deep Link Access - Unauthenticated', async ({ page }) => {
    // Attempt to access a protected route directly without authentication.
    const deepLink = Services.Gameboard.UI + '/admin/registrar/users';
    await page.goto(deepLink, { waitUntil: 'domcontentloaded' });
    // Should be redirected to the in-app login page with a redirectTo preserving the intended destination.
    await expect(page).toHaveURL(/\/login\?redirectTo=/);
    // The redirectTo query parameter should reference the admin path.
    const currentUrl = page.url();
    expect(decodeURIComponent(currentUrl)).toMatch(/redirectTo=.*admin/);
    // Login button is present to continue the OIDC flow.
    await expect(page.locator('button:has-text("Login"), button:has-text("Log in")').first()).toBeVisible();
  });
});
