// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection, CITE_THEMES, applyCiteTheme } from '../../test-helpers';

for (const theme of CITE_THEMES) {

  test.describe(`${theme} theme › Administration - Users`, () => {
  test('Users Section', async ({ citeAuthenticatedPage: page }) => {
    await applyCiteTheme(page, theme);

    await navigateToAdminSection(page, 'Users');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });
  });
  });
}
