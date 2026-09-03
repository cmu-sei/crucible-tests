// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

test.describe('Integration and API', () => {
  // This spec asserts the full Keycloak redirect/callback round-trip, so it must
  // opt out of the pre-authenticated storageState from gallery/fixtures.ts.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Keycloak Authentication Integration', async ({ page }) => {
    // 1. Navigate to the Gallery UI
    await page.goto(Services.Gallery.UI);

    // expect: Application redirects to Keycloak login page
    await page.waitForURL(serviceUrlPattern(Services.Keycloak), { timeout: 15000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });

    // 2. Enter valid credentials and submit
    await page.getByRole('textbox', { name: 'Username or email' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('admin');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // expect: Keycloak authenticates the user
    // expect: User is redirected back to Gallery via auth-callback
    // expect: User lands on the My Exhibits page
    await expect(page).toHaveTitle('Gallery');
    await expect(page.getByText('My Exhibits')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Admin User' })).toBeVisible();
  });
});
