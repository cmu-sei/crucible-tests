// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import path from 'path';
import os from 'os';

test.describe('Export and Import', () => {
  test('Import MSEL from Excel', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSELs list
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the build page
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSELs list is displayed with existing MSELs
    const downloadButton = page.getByRole('button', { name: 'Download Standard MSEL' });
    await expect(downloadButton).toBeVisible({ timeout: 10000 });

    // 2. Download an existing MSEL as xlsx to use as import test data
    await downloadButton.click();
    const downloadXlsxMenuItem = page.getByRole('menuitem', { name: 'Download xlsx file' });
    await expect(downloadXlsxMenuItem).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent('download');
    await downloadXlsxMenuItem.click();
    const download = await downloadPromise;

    // Save the downloaded file to a local temp path (saveAs works in remote environments)
    const downloadPath = path.join(os.tmpdir(), `msel-import-test-${Date.now()}.xlsx`);
    await download.saveAs(downloadPath);

    // 3. Click 'Upload a new MSEL from a file' button to open upload menu
    const uploadButton = page.getByRole('button', { name: 'Upload a new MSEL from a file' });
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();

    // 4. Select 'Upload xlsx file' from the menu
    const uploadXlsxMenuItem = page.getByRole('menuitem', { name: 'Upload xlsx file' });
    await expect(uploadXlsxMenuItem).toBeVisible({ timeout: 5000 });

    // Set up file chooser handler before clicking the menu item
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadXlsxMenuItem.click();
    const fileChooser = await fileChooserPromise;

    // 5. Upload the downloaded xlsx file
    await fileChooser.setFiles(downloadPath);

    // expect: New MSEL appears in the list after import
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify a new MSEL was added to the list - look for "Uploaded from" in the description
    const uploadedMsel = page.getByRole('cell', { name: /Uploaded from/ }).first();
    await expect(uploadedMsel).toBeVisible({ timeout: 10000 });
  });
});
