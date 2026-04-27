// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('Unauthorized Access Protection', async ({ page }) => {
    // 1. Clear all cookies and local storage to simulate unauthenticated state
    // (storageState override above ensures clean state)

    // expect: Session is cleared

    // 2. Attempt to navigate directly to a protected route (e.g., http://localhost:4301/admin)
    await page.goto(`${Services.Player.UI}/admin`);

    // expect: User is redirected to Keycloak login page
    await page.getByText('Sign in to your account').first().waitFor({ state: 'visible', timeout: 70000 });
    await expect(page).toHaveURL(/localhost:8443/);

    // expect: Protected route is not accessible without authentication
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  });
});
