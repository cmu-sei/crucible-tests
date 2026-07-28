// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: steamfitter/steamfitter-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';
import { seedGroup, deleteGroupsByPrefix } from '../../fixtures';
import { navigateToAdminSection } from '../../test-helpers';

/**
 * A group is deleted from its row via the "Delete <name>" button, which raises a
 * confirm dialog. This spec seeds a group, deletes it through the UI, and confirms its
 * row is gone. The API-prefix cleanup is a backstop in case the UI delete fails.
 */
test.describe('Group Management in Admin', () => {
  const GROUP_NAME = `E2E Delete Group ${Date.now()}`;

  test.beforeEach(async () => {
    await seedGroup(GROUP_NAME);
  });

  test.afterEach(async () => {
    await deleteGroupsByPrefix(['E2E Delete Group']);
  });

  test('Delete a group', async ({ steamfitterAuthenticatedPage: page }) => {
    await navigateToAdminSection(page, 'Groups');

    // Isolate the seeded group's row.
    const groupSearch = page.getByRole('textbox', { name: 'Search Groups' });
    await groupSearch.fill(GROUP_NAME);
    await page.waitForTimeout(500);
    const groupRow = page.locator('tbody tr').filter({ hasText: GROUP_NAME }).first();
    await expect(groupRow).toBeVisible({ timeout: 10000 });

    // Delete via the per-row button, then confirm.
    const deleteResponse = page.waitForResponse(
      (response) =>
        /\/api\/groups\//.test(response.url()) &&
        response.request().method() === 'DELETE' &&
        response.ok(),
      { timeout: 15000 }
    );
    await groupRow.locator('button:has(mat-icon[fonticon*="trash"])').click();

    const confirmDialog = page.getByRole('dialog').first();
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });
    await confirmDialog.getByRole('button', { name: /Yes|Delete|Confirm/i }).click();
    await deleteResponse;

    // The group row should no longer be present.
    await groupSearch.fill(GROUP_NAME);
    await page.waitForTimeout(500);
    await expect(
      page.locator('tbody tr').filter({ hasText: GROUP_NAME })
    ).toHaveCount(0, { timeout: 10000 });
  });
});
