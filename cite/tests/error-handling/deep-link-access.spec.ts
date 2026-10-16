// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, serviceUrlPattern, CITE_THEMES, setCiteTheme, citeThemeUrl } from '../../fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
    test('Deep Link Access', async ({ page }) => {

      // 1-2. Navigate to deep link URL without auth
      // The Keycloak screens aren't CITE's, so the theme is requested on the deep link
      // and applied for certain once the login lands back in CITE.
      await page.goto(citeThemeUrl(`${Services.Cite.UI}/?evaluation=test-eval-id`, theme));

      // expect: User is redirected to login
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 70000 });

      // 3. After login, user should be redirected back
      await page.fill('input[name="username"]', 'admin');
      await page.fill('input[name="password"]', 'admin');
      await page.click('#kc-login');

      // expect: After login, user is redirected back to intended deep link
      await page.waitForURL(serviceUrlPattern(Services.Cite.UI), { timeout: 30000 });
      // The URL matches on the /auth-callback hop too; wait for the app shell before
      // reaching for its user menu.
      await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 30000 });
      await setCiteTheme(page, theme);
    });
  });
}
