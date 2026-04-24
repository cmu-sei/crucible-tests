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
    testGroupName = `Membership Group ${Date.now()}`;
  });

  test.afterEach(async () => {
    // Use Gallery API to delete this test's group (reliable, no UI race conditions)
    await apiDeleteGroupByName(testGroupName);
  });

  test('Group Membership Management', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Groups section
    await page.locator('mat-list-item').filter({ hasText: 'Groups' }).getByRole('button').click();

    // Clean up stale groups from previous runs via API (fast, no UI dependency)
    await apiCleanupGroups();

    // Setup: Create a group to manage memberships
    const addGroupButton = page.getByRole('columnheader').first().getByRole('button').first();
    await addGroupButton.click();
    const createDialog = page.getByRole('dialog');
    await createDialog.waitFor({ state: 'visible', timeout: 5000 });
    await createDialog.getByRole('textbox').fill(testGroupName);
    await createDialog.getByRole('button', { name: /save|ok|confirm|add/i }).click();
    await expect(page.getByRole('cell', { name: testGroupName })).toBeVisible();

    // 1. Click on a group to view its details
    const groupRow = page.getByRole('row').filter({ hasText: testGroupName });
    await groupRow.click();

    // expect: Group detail view opens showing group information and memberships
    // The details panel should show membership management options
  });
});
