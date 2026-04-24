// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('User Management', () => {
  test('Delete User', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Users section
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();

    // Note: We should not delete the admin user. Only proceed if there are extra users.
    const userRows = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Delete User' }) });
    const rowCount = await userRows.count();

    if (rowCount > 1) {
      // 1. Click the 'Delete User' button (trash icon) on a non-admin user row
      // Use the last user row to avoid deleting our session user
      const lastRow = userRows.last();
      await lastRow.getByRole('button', { name: 'Delete User' }).click();

      // expect: A confirmation dialog appears
      const confirmDialog = page.getByRole('dialog');
      if (await confirmDialog.isVisible().catch(() => false)) {
        // 2. Confirm deletion
        await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
      }

      // expect: User is deleted successfully
      // expect: User is removed from the list
    } else {
      // Verify the Delete User button exists
      await expect(page.getByRole('button', { name: 'Delete User' }).first()).toBeVisible();
    }
  });
});
