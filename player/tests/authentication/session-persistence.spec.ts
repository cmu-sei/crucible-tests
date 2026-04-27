// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Authentication', () => {
  test('Session Persistence After Refresh', async ({ playerAuthenticatedPage: page }) => {
    // 1. Log in with valid credentials (admin/admin)
    // expect: User is successfully authenticated and viewing Player home page
    await expect(page).toHaveURL(/localhost:4301/, { timeout: 10000 });
    await expect(page.getByText('My Views')).toBeVisible();

    // 2. Refresh the browser page
    await page.reload();

    // expect: User remains authenticated
    // expect: Home page loads without redirecting to Keycloak
    await expect(page).toHaveURL(/localhost:4301/, { timeout: 10000 });

    // expect: User session is maintained
    await expect(page.getByText('My Views')).toBeVisible();
    await expect(page.getByText('Admin User').first()).toBeVisible();
  });
});
