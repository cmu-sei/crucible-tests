// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, serviceUrlPattern, CITE_THEMES, citeThemeUrl } from '../../fixtures';

// Override global storageState so this test starts from a fresh unauthenticated state.
test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Authentication and Authorization`, () => {
    test('Unauthorized Access Protection', async ({ page }) => {

      // 1. Start from an unauthenticated state
      // The empty storageState above already gives the context no cookies and no storage
      // for any origin. Loading CITE here only to clear storage would start an OIDC
      // redirect to Keycloak that races the navigation below; Firefox aborts one of the
      // two (NS_BINDING_ABORTED).

      // expect: Session is cleared
      expect(await page.context().cookies()).toEqual([]);
      // 2. Attempt to navigate directly to a protected route (e.g., http://localhost:4721/admin)
      // No CITE screen renders before the redirect, so the user-menu theme switch never
      // exists. The theme is requested on the protected URL instead, the only theme input an
      // unauthenticated visitor has; the route must stay protected in either theme.
      await page.goto(citeThemeUrl(`${Services.Cite.UI}/admin`, theme));

      // expect: User is redirected to Keycloak login page
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 70000 });

      // expect: Protected route is not accessible without authentication
      const usernameField = page.locator('#username');
      await expect(usernameField).toBeVisible({ timeout: 10000 });
    });
  });
}
