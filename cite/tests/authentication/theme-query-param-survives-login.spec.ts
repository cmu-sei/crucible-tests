// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '@playwright/test';
import { Services, serviceUrlPattern, CITE_THEMES, citeIsDarkTheme, citeThemeUrl } from '../../fixtures';

// Override global storageState so the entry URL goes through the Keycloak login.
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * A `?theme=` on the entry URL is still in effect once the login lands back in CITE.
 *
 * The top bar restores the saved theme when it initializes, and it initializes after
 * the login redirect. It used to restore light over the param's theme, and the app
 * then rewrote the URL to `?theme=light-theme`. This spec never touches the user
 * menu, so the theme it sees can only have come from the param.
 */
for (const theme of CITE_THEMES) {
  test.describe(`${theme} theme › Authentication and Authorization`, () => {
    test('Theme query param survives the login redirect', async ({ page }) => {
      // 1. Open CITE with the theme on the entry URL
      await page.goto(citeThemeUrl(Services.Cite.UI, theme));

      // expect: User is redirected to the Keycloak login page
      await expect(page).toHaveURL(serviceUrlPattern(Services.Keycloak), { timeout: 70000 });

      // 2. Log in
      await page.locator('#username').fill('admin');
      await page.locator('#password').fill('admin');
      await page.click('#kc-login');

      // expect: CITE's shell renders in the requested theme, and the URL keeps it
      await page.locator('app-root mat-toolbar').first().waitFor({ state: 'visible', timeout: 30000 });
      await expect.poll(() => citeIsDarkTheme(page), { timeout: 10000 }).toBe(theme === 'dark');
      await expect(page).toHaveURL(new RegExp(`[?&]theme=${theme}-theme`));

      // expect: The theme holds once the app has settled
      await page.waitForLoadState('networkidle');
      expect(await citeIsDarkTheme(page)).toBe(theme === 'dark');
      await expect(page).toHaveURL(new RegExp(`[?&]theme=${theme}-theme`));
    });
  });
}
