// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: topomojo/topomojo-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern, topomojoNavLink } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication and Authorization', () => {
  test('Logout Functionality', async ({ topomojoAuthenticatedPage: page }) => {

    // 1. Log in with valid credentials (admin/admin) - handled by fixture
    // expect: User is successfully authenticated
    await expect(page).toHaveURL(serviceUrlPattern(Services.TopoMojo.UI));

    // 2. Click 'Logout' link in top navigation
    const logoutLink = topomojoNavLink(page, 'Logout');
    await expect(logoutLink).toBeVisible({ timeout: 10000 });
    await logoutLink.click();

    // expect: User is logged out and redirected

    // 3. Attempt to navigate to TopoMojo UI again
    await page.goto(Services.TopoMojo.UI);

    // expect: User sees the landing page with login button
    // expect: User must authenticate again (TopoMojo shows landing page, not auto-redirect to Keycloak)
    await page.waitForLoadState('domcontentloaded');
    const loginButton = page.getByRole('button', { name: 'identity provider' });
    await expect(loginButton).toBeVisible({ timeout: 10000 });
    const loginText = page.locator('text=Please login to continue');
    await expect(loginText).toBeVisible({ timeout: 5000 });
  });
});
