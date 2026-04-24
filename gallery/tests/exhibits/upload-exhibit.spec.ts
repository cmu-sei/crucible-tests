// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Exhibit Management', () => {
  test('Upload Exhibit from JSON', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Exhibits section and select a collection with exhibits
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();
    const firstOption = page.getByRole('option').first();
    await firstOption.click();

    // First, download an exhibit to use as upload source
    // Get all table rows and find the first one that contains exhibit data (not header)
    const tableRows = page.getByRole('table').getByRole('row');
    // Find first row that has action buttons (indicates it's a data row, not header)
    const dataRow = tableRows.filter({ has: page.locator('button[title*="Download"]') }).first();
    await expect(dataRow).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await dataRow.locator('button[title*="Download"]').click();
    const download = await downloadPromise;

    // Save the downloaded file
    const tempPath = path.join(os.tmpdir(), `gallery-exhibit-upload-test-${Date.now()}.json`);
    await download.saveAs(tempPath);

    // 1. Click the 'Upload Exhibit' button (upload icon) in the exhibits header
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Exhibit' }).click();

    // 2. Select a valid JSON exhibit file to upload
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempPath);

    // expect: The exhibit is imported successfully
    // expect: The new exhibit appears in the list

    // Cleanup: Remove temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  });
});
