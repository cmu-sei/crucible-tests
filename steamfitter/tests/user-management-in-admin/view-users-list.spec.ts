// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * The admin Users section renders a single flat table (id / Name / Role) with a
 * Search box; there is no per-user detail view (the role is assigned inline). This
 * spec just confirms the section loads with its table and search control.
 */
test.describe('User Management in Admin', () => {
  test('View users list', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Users');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // The seeded admin user is always present.
    await expect(page.locator('tbody tr').filter({ hasText: 'admin' }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
