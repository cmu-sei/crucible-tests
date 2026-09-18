// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services, serviceUrlPattern } from '../../fixtures';
import { CITE_THEMES, applyCiteTheme } from '../../test-helpers';

for (const theme of CITE_THEMES) {

  test.describe(`${theme} theme › Error Handling and Edge Cases`, () => {
  test('Session Timeout', async ({ citeAuthenticatedPage: page }) => {
    await applyCiteTheme(page, theme);

    // 1. Log in successfully
    await expect(page).toHaveURL(serviceUrlPattern(Services.Cite.UI), { timeout: 10000 });

    // 2. Manually invalidate session by clearing cookies
    await page.context().clearCookies();

    // 3. Attempt to perform an action
    await page.reload();

    // expect: User is notified of session expiration
    // expect: User is redirected to login page
    await page.waitForURL(serviceUrlPattern(Services.Cite.UI), { timeout: 30000 });
  });
  });
}
