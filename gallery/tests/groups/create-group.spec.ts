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
    testGroupName = `Test Group ${Date.now()}`;
  });

  test.afterEach(async () => {
    // Use Gallery API to delete this test's group (reliable, no UI race conditions)
    await apiDeleteGroupByName(testGroupName);
  });

  test('Create Group', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Groups section
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();

    // Clean up stale groups from previous runs via API (fast, no UI dependency)
    await apiCleanupGroups();

    // 1. Click the Add Group button (plus icon)
    const addGroupButton = page.getByRole('columnheader').first().getByRole('button').first();
    await addGroupButton.click();

    // expect: A group creation dialog or form opens
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // 2. Enter a group name and save
    await dialog.getByRole('textbox').fill(testGroupName);
    await dialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();

    // expect: Group is created successfully
    // expect: New group appears in the groups list
    await expect(page.getByRole('cell', { name: testGroupName })).toBeVisible();
  });
});
