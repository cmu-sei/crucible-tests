// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import path from 'node:path';
import os from 'node:os';

test.describe('Export and Import', () => {
  test('Upload XLSX to Existing MSEL', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // 1. Wait for MSELs list to load
    const downloadButton = page.getByRole('button', { name: 'Download Standard MSEL' });
    await expect(downloadButton).toBeVisible({ timeout: 10000 });

    // 2. Download the Standard MSEL as xlsx to use as valid upload data
    await downloadButton.click();
    const downloadXlsxMenuItem = page.getByRole('menuitem', { name: 'Download xlsx file' });
    await expect(downloadXlsxMenuItem).toBeVisible({ timeout: 5000 });
    const downloadPromise = page.waitForEvent('download');
    await downloadXlsxMenuItem.click();
    const download = await downloadPromise;

    // expect: File downloads with xlsx extension
    expect(download.suggestedFilename()).toContain('.xlsx');

    const downloadPath = path.join(os.tmpdir(), `upload-xlsx-test-${Date.now()}.xlsx`);
    await download.saveAs(downloadPath);

    // 3. Click 'Upload .xlsx file to [MSEL name]' for Standard MSEL
    const uploadXlsxButton = page.getByRole('button', { name: /Upload \.xlsx file to Standard MSEL/ });
    await expect(uploadXlsxButton).toBeVisible({ timeout: 5000 });

    // expect: A file chooser opens
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadXlsxButton.click();
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();

    // 4. Upload the valid xlsx file
    await fileChooser.setFiles(downloadPath);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // expect: The page remains on the build page and MSEL list is intact
    await expect(page).toHaveURL(/.*\/build.*/, { timeout: 5000 });
    const standardMselLink = page.getByRole('link', { name: 'Standard MSEL' });
    await expect(standardMselLink).toBeVisible({ timeout: 10000 });
  });
});
