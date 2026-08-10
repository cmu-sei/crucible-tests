// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedGroup, deleteGroupsByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * The admin Groups section renders a searchable table of groups (each row expandable to
 * a membership editor). This spec seeds a group, opens the section, and confirms the
 * table plus its Search box are present and the seeded group can be surfaced.
 */
test.describe('Group Management in Admin', () => {
  const GROUP_NAME = `E2E View Group ${Date.now()}`;

  test.beforeEach(async () => {
    await seedGroup(GROUP_NAME);
  });

  test.afterEach(async () => {
    await deleteGroupsByPrefix(['E2E View Group']);
  });

  test('View groups list', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Groups');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await expect(searchField).toBeVisible({ timeout: 5000 });

    // Search to isolate the seeded group's row.
    await searchField.fill(GROUP_NAME);
    await page.waitForTimeout(500);
    await expect(page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
