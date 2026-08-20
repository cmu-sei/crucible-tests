// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';

test.describe('Authentication and Authorization', () => {
  // The whole point of this spec is that an *unauthenticated* visitor gets
  // bounced to Keycloak, so it must override the pre-authenticated storageState
  // that gallery/fixtures.ts applies by default.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Unauthorized Access Prevention', async ({ page }) => {
    // 1. Without authentication, attempt to access the Gallery UI
    await page.goto(Services.Gallery.UI);

    // expect: The application redirects to Keycloak login page
    // The Angular OIDC client redirects asynchronously, so we need to wait for the Keycloak URL first
    await page.waitForURL(serviceUrlPattern(Services.Keycloak), { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
    await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak));

    // 2. Without authentication, attempt to access the admin route directly
    await page.goto(`${Services.Gallery.UI}/admin`);

    // expect: The application redirects to Keycloak login page
    await page.waitForURL(serviceUrlPattern(Services.Keycloak), { timeout: 30000 });
    await page.getByRole('button', { name: 'Sign In' }).waitFor({ state: 'visible' });
    await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak));
  });
});
