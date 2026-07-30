// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedUser, deleteUsersByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A system role is assigned to a user inline, via the `mat-select` in that user's Role
 * column (there is no separate user detail view). Selecting a role PUTs the user with
 * its `roleId` set. This spec seeds a user, searches to isolate its row, assigns the
 * built-in "Content Developer" role, waits on the PUT, and confirms the select now
 * shows that role after a reload.
 */
test.describe('User Management in Admin', () => {
  const USER_NAME = `E2E Role User ${Date.now()}`;
  const ROLE_NAME = 'Content Developer';

  test.beforeEach(async () => {
    await seedUser(USER_NAME);
  });

  test.afterEach(async () => {
    await deleteUsersByPrefix(['E2E Role User']);
  });

  test('Assign a system role to a user', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Users');

    // 1. Search to isolate the seeded user's row.
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(USER_NAME);
    const row = page.locator('tbody tr').filter({ hasText: USER_NAME }).first();
    await expect(row).toBeVisible({ timeout: 5000 });

    // 2. Open the row's role select and pick ContentDeveloper. Wait on the user PUT so
    // the assignment is persisted before we re-check.
    const roleSelect = row.getByRole('combobox');
    await roleSelect.click();
    const putResponse = page.waitForResponse(
      (response) =>
        /\/api\/users\//.test(response.url()) &&
        response.request().method() === 'PUT' &&
        response.ok(),
      { timeout: 15000 }
    );
    await page.getByRole('option', { name: ROLE_NAME, exact: true }).click();
    await putResponse.catch(() => {});

    // 3. Reload the section, re-isolate the row, and confirm the select shows the role.
    await navigateToAdminSection(page, 'Users');
    await searchField.fill(USER_NAME);
    const reloadedRow = page.locator('tbody tr').filter({ hasText: USER_NAME }).first();
    await expect(reloadedRow.getByRole('combobox')).toContainText(ROLE_NAME, { timeout: 10000 });
  });
});
