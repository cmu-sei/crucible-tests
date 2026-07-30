// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { deleteGroupsByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A new group is created from the Groups section via the "Add New Group" button, which
 * opens a NameDialog ("Create New Group?"). This spec creates a uniquely-named group
 * through the UI, then confirms its row appears in the table. Cleanup is by API prefix.
 */
test.describe('Group Management in Admin', () => {
  const GROUP_NAME = `E2E Create Group ${Date.now()}`;

  test.afterEach(async () => {
    await deleteGroupsByPrefix(['E2E Create Group']);
  });

  test('Create a new group', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Groups');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    await page.locator('button[mattooltip="Add New Group"]').click();

    const dialog = page.getByRole('dialog', { name: 'Create New Group?' });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await dialog.getByRole('textbox', { name: 'Name' }).fill(GROUP_NAME);

    const saveButton = dialog.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // The new group should surface via search.
    const searchField = page.getByRole('textbox', { name: 'Search Groups' });
    await searchField.fill(GROUP_NAME);
    await expect(page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
