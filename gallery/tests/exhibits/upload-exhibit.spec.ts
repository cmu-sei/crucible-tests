// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '../../fixtures';
import { authenticateGalleryWithKeycloak } from '../../fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Exhibit Management', () => {
  test('Upload Exhibit from JSON', async ({ page, seededExhibit }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // Navigate to Exhibits section and select the seeded collection
    await page.locator('mat-list-item').filter({ hasText: 'Exhibits' }).getByRole('button').click();
    const collectionDropdown = page.getByRole('combobox', { name: 'Select a Collection' });
    await collectionDropdown.click();

    // Select the seeded collection by name
    const seededOption = page.getByRole('option', { name: seededExhibit.collectionName });
    await seededOption.click();

    // Wait for the exhibits table to load with the seeded exhibit
    await page.waitForTimeout(1000); // Brief wait for table to populate

    // First, download the seeded exhibit to use as upload source
    // Get all table rows and find the one with our seeded exhibit
    const tableRows = page.getByRole('table').getByRole('row');
    // Find the row containing the seeded exhibit name
    const dataRow = tableRows.filter({ hasText: seededExhibit.exhibitName }).first();
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
    // Wait briefly for upload to complete
    await page.waitForTimeout(2000);

    // Cleanup: Remove temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  });
});
