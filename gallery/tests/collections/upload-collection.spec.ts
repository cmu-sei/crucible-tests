// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Collection Management', () => {
  test('Upload Collection from JSON', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // First, download a collection to use as upload source
    const existingRow = page.getByRole('row').nth(1);
    await expect(existingRow).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await existingRow.getByRole('button', { name: /^Download / }).click();
    const download = await downloadPromise;

    // Save the downloaded file
    const tempPath = path.join(os.tmpdir(), `gallery-upload-test-${Date.now()}.json`);
    await download.saveAs(tempPath);

    // 1. Click the 'Upload Collection' button (upload icon) in the collections header
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Collection' }).click();

    // 2. Select a valid JSON collection file to upload
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempPath);

    // expect: The collection is imported successfully
    // expect: The new collection appears in the list

    // Cleanup: Remove temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  });
});
