// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedUser, deleteUsersByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * The Users list filters client-side as you type into its Search box. This spec seeds
 * a uniquely-named user, searches for it to isolate its row (the list paginates at 20,
 * so searching is how we reliably surface a specific user), then clears the search and
 * confirms the list repopulates.
 */
test.describe('User Management in Admin', () => {
  const USER_NAME = `E2E Search User ${Date.now()}`;

  test.beforeEach(async () => {
    await seedUser(USER_NAME);
  });

  test.afterEach(async () => {
    await deleteUsersByPrefix(['E2E Search User']);
  });

  test('Search users', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Users');

    const searchField = page.getByRole('textbox', { name: 'Search' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // 1. Search for the seeded user; only its row should remain.
    await searchField.fill(USER_NAME);
    await page.waitForTimeout(500);
    const matchingRow = page.locator('tbody tr').filter({ hasText: USER_NAME }).first();
    await expect(matchingRow).toBeVisible({ timeout: 5000 });

    // 2. Clear the search; the list repopulates with more than the single match.
    await searchField.fill('');
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').filter({ hasText: 'admin' }).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
