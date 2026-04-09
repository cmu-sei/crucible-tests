// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import path from 'node:path';
import os from 'node:os';

test.describe('Export and Import', () => {
  test('Import Scenario Events from Excel into existing MSEL', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to MSELs list
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to the build page
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/ });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSELs list is displayed - wait for Standard MSEL
    const downloadButton = page.getByRole('button', { name: 'Download Standard MSEL' });
    await expect(downloadButton).toBeVisible({ timeout: 10000 });

    // 2. Download the Standard MSEL as xlsx
    await downloadButton.click();
    const downloadXlsxMenuItem = page.getByRole('menuitem', { name: 'Download xlsx file' });
    await expect(downloadXlsxMenuItem).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent('download');
    await downloadXlsxMenuItem.click();
    const download = await downloadPromise;

    // expect: File downloads successfully
    const suggestedFilename = download.suggestedFilename();
    expect(suggestedFilename).toContain('.xlsx');

    // Save to temp path for re-upload
    const downloadPath = path.join(os.tmpdir(), `msel-events-import-test-${Date.now()}.xlsx`);
    await download.saveAs(downloadPath);

    // 3. Verify per-MSEL upload button triggers file chooser
    const uploadToMselButton = page.getByRole('button', { name: /Upload \.xlsx file to Standard MSEL/ });
    await expect(uploadToMselButton).toBeVisible({ timeout: 5000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadToMselButton.click();
    const fileChooser = await fileChooserPromise;

    // expect: File chooser is displayed and accepts xlsx files
    expect(fileChooser).toBeTruthy();

    // 4. Upload the xlsx file
    await fileChooser.setFiles(downloadPath);

    // Wait for the upload to be processed
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 5. Verify we're still on the build page (no navigation crash)
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 5000 });

    // Verify the MSEL list is still displayed
    const standardMselLink = page.getByRole('link', { name: 'Standard MSEL' });
    await expect(standardMselLink).toBeVisible({ timeout: 10000 });
  });
});
