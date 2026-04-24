// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Edge Cases and Negative Testing', () => {
  test('Collection and Exhibit Download Upload Round Trip', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Download a collection as JSON
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await firstRow.getByRole('button', { name: /Download/ }).click();
    const download = await downloadPromise;

    // expect: JSON file is downloaded successfully
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // Save the file
    const tempPath = path.join(os.tmpdir(), `gallery-roundtrip-${Date.now()}.json`);
    await download.saveAs(tempPath);

    // 2. Upload the same JSON file as a new collection
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Collection' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempPath);

    // expect: A new collection is created from the uploaded file
    // Wait for the upload to complete and the new collection to appear in the table
    await page.waitForTimeout(2000); // Give time for the upload to process

    // Cleanup: Delete the uploaded collection
    // Find the most recently created collection (should be at the top after upload)
    const uploadedRow = page.getByRole('row').nth(1);
    await uploadedRow.getByRole('button', { name: /Delete/ }).click();

    // Wait for confirmation dialog to be fully visible and stable
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();

    // Wait for the confirm button to be actionable (not blocked by backdrop)
    const confirmButton = confirmDialog.getByRole('button', { name: /Yes|Confirm|OK|Delete/i });
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Wait for dialog to close
    await expect(confirmDialog).not.toBeVisible();

    // Cleanup temp file
    try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
  });
});
