// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedSystemRole, deleteSystemRolesByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A custom (mutable) system role can be deleted from its column header via the "Delete
 * Role" button, which raises a confirm dialog ("Delete Role?"). Built-in roles are
 * immutable and expose no such button. This spec seeds a custom role, deletes it through
 * the UI, and confirms its column header is gone. API-prefix cleanup is a backstop.
 */
test.describe('Role Management in Admin', () => {
  const ROLE_NAME = `E2E Delete Role ${Date.now()}`;

  test.beforeEach(async () => {
    await seedSystemRole(ROLE_NAME);
  });

  test.afterEach(async () => {
    await deleteSystemRolesByPrefix(['E2E Delete Role']);
  });

  test('Delete a custom system role', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await rolesTab.click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const roleHeader = page.getByRole('columnheader', { name: ROLE_NAME });
    await expect(roleHeader).toBeVisible({ timeout: 10000 });

    // Delete via the header's "Delete Role" button, then confirm.
    const deleteResponse = page.waitForResponse(
      (response) =>
        /\/api\/system-roles\//.test(response.url()) &&
        response.request().method() === 'DELETE' &&
        response.ok(),
      { timeout: 15000 }
    );
    await roleHeader.getByRole('button', { name: 'Delete Role' }).click();

    const confirmDialog = page.getByRole('dialog', { name: 'Delete Role?' });
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: 'Delete' }).click();
    await deleteResponse;

    // The role's column header should no longer be present.
    await expect(
      page.getByRole('columnheader', { name: ROLE_NAME })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
