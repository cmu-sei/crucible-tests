// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Group Management', () => {
  test('View Groups List', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Navigate to admin section and click 'Groups' in the sidebar
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();

    // expect: Groups list page loads with a table showing 'Group Name' column
    await expect(page.getByRole('columnheader', { name: 'Group Name' })).toBeVisible();

    // expect: A 'Search Groups' text field is visible
    await expect(page.getByRole('textbox', { name: 'Search Groups' })).toBeVisible();

    // expect: A 'Clear Search' button is visible (disabled when no search term)
    await expect(page.getByRole('button', { name: 'Clear Search' })).toBeVisible();

    // expect: An Add Group button (plus icon) is visible
    const addGroupButton = page.getByRole('columnheader').first().getByRole('button').first();
    await expect(addGroupButton).toBeVisible();
  });
});
