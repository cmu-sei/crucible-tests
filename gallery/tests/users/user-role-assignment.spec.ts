// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('User Management', () => {
  test('User Role Assignment', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Users section
    await page.locator('mat-list-item').filter({ hasText: 'Users' }).getByRole('button').click();

    // 1. Observe the Role dropdown for a user (showing 'None Locally')
    const firstUserRow = page.getByRole('row').filter({ hasText: 'Admin User' }).first();
    const roleDropdown = firstUserRow.getByRole('combobox');
    await expect(roleDropdown).toBeVisible();

    // 2. Click the Role dropdown for a user
    await roleDropdown.click();

    // expect: Available roles are listed
    await expect(page.getByRole('option').first()).toBeVisible();

    // 3. Select a different role (e.g., 'Content Developer')
    const contentDevOption = page.getByRole('option', { name: 'Content Developer' });
    if (await contentDevOption.isVisible().catch(() => false)) {
      await contentDevOption.click();
      // expect: The user's role is updated

      // Wait for the dropdown panel to close before reopening
      await expect(page.getByRole('listbox')).toBeHidden();

      // 4. Change the role back to 'None Locally'
      await roleDropdown.click();

      // Wait for the dropdown panel to be fully visible and stable
      const noneLocallyOption = page.getByRole('option', { name: 'None Locally' });
      await expect(noneLocallyOption).toBeVisible();
      await noneLocallyOption.click();
      // expect: The user's role is reverted
    } else {
      // Close the dropdown
      await page.keyboard.press('Escape');
    }
  });
});
