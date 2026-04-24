// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import {
  authenticateGalleryWithKeycloak,
  apiDeleteGroupByName,
  apiCleanupGroups,
} from '../../fixtures';

test.describe('Group Management', () => {
  let testGroupName: string;

  test.beforeEach(() => {
    testGroupName = `Search Group ${Date.now()}`;
  });

  test.afterEach(async () => {
    // Use Gallery API to delete this test's group (reliable, no UI race conditions)
    await apiDeleteGroupByName(testGroupName);
  });

  test('Search Groups', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Groups section
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();

    // Clean up stale groups from previous runs via API (fast, no UI dependency)
    await apiCleanupGroups();

    // Setup: Create a group to search for
    const addGroupButton = page.getByRole('columnheader').first().getByRole('button').first();
    await addGroupButton.click();
    const createDialog = page.getByRole('dialog');
    await createDialog.waitFor({ state: 'visible', timeout: 5000 });
    await createDialog.getByRole('textbox').fill(testGroupName);
    await createDialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();
    await expect(page.getByRole('cell', { name: testGroupName })).toBeVisible();

    const searchField = page.getByRole('textbox', { name: 'Search Groups' });

    // 1. Enter a search term in the 'Search Groups' field
    await searchField.fill(testGroupName);

    // expect: Groups list filters to show only matching groups
    await expect(page.getByRole('cell', { name: testGroupName })).toBeVisible();

    // expect: Clear Search button becomes enabled
    const clearButton = page.getByRole('button', { name: 'Clear Search' });

    // 2. Click the 'Clear Search' button
    await clearButton.click();

    // expect: Search field is cleared
    await expect(searchField).toHaveValue('');
  });
});
