// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { deleteSystemRolesByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A custom system role is created from the System Roles grid via the "Add New Role"
 * button in the Permissions header, which opens a NameDialog ("Create New Role?"). This
 * spec creates a uniquely-named role and confirms a matching column header appears.
 * Cleanup is by API prefix (built-in immutable roles are skipped by the helper).
 */
test.describe('Role Management in Admin', () => {
  const ROLE_NAME = `E2E Create Role ${Date.now()}`;

  test.afterEach(async () => {
    await deleteSystemRolesByPrefix(['E2E Create Role']);
  });

  test('Create a custom system role', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Roles');

    const rolesTab = page.getByRole('tab', { name: 'Roles', exact: true });
    await rolesTab.click();
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    await page.locator('button[mattooltip="Add New Role"]').click();

    const dialog = page.getByRole('dialog', { name: 'Create New Role?' });
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('textbox', { name: 'Name' }).fill(ROLE_NAME);

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // The new role appears as a column header in the grid.
    await expect(
      page.getByRole('columnheader', { name: ROLE_NAME })
    ).toBeVisible({ timeout: 10000 });
  });
});
