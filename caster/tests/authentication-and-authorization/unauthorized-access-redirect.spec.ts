// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Unauthorized Access Redirect', async ({ page }) => {

    // 1. Clear all browser cookies and local storage
    // expect: All authentication tokens are removed
    // (Fresh browser context with no storageState ensures no tokens exist)

    // 2. Navigate to http://localhost:4310/admin
    await page.goto(Services.Caster.UI + '/admin');

    // expect: The application redirects to the Keycloak login page
    await expect(page).toHaveURL(/.*localhost:8443.*realms\/crucible/, { timeout: 70000 });

    // expect: No application content is displayed before authentication
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });
});
