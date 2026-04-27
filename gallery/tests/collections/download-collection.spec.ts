// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Collection Management', () => {
  const testCollectionName = `Download Test Collection ${Date.now()}`;

  test('Download Collection as JSON', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Setup: Create a collection to download
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel('Name').fill(testCollectionName);
    await createDialog.getByLabel('Description').fill('Collection for download test');
    await createDialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(testCollectionName)).toBeVisible();

    // 1. Click the Download button (download icon) on a collection row
    const row = page.getByRole('row').filter({ hasText: testCollectionName });
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: `Download ${testCollectionName}` }).click();

    // expect: A JSON file download begins
    const download = await downloadPromise;

    // expect: The downloaded file contains the collection data
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Cleanup: Delete the created collection
    await row.getByRole('button', { name: `Delete ${testCollectionName}` }).click();
    const confirmDialog = page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i }).click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.getByText(testCollectionName, { exact: true })).not.toBeVisible();
  });
});
