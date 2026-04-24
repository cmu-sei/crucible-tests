// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

test.describe('Administration - Users', () => {
  test('Users Section', async ({ citeAuthenticatedPage: page }) => {

    await navigateToAdminSection(page, 'Users');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });
  });
});
