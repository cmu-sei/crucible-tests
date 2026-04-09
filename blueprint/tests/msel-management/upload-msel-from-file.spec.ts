// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import path from 'node:path';
import os from 'node:os';

test.describe('MSEL Management', () => {
  let uploadedMselName: string | null = null;

  test.afterEach(async ({ blueprintAuthenticatedPage: page }) => {
    // Cleanup: Delete the uploaded MSEL if it exists
    if (uploadedMselName) {
      const currentUrl = page.url();
      if (!currentUrl.includes('/build')) {
        await page.goto(`${Services.Blueprint.UI}/build`);
        await page.waitForLoadState('networkidle');
      } else if (currentUrl.includes('?msel=')) {
        // We're on a MSEL detail page, navigate back to list
        await page.goto(`${Services.Blueprint.UI}/build`);
        await page.waitForLoadState('networkidle');
      }

      // Look for the uploaded MSEL in the list
      const uploadedMselLink = page.getByRole('link', { name: uploadedMselName }).first();

      if (await uploadedMselLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uploadedMselLink.click();
        await page.waitForLoadState('networkidle');

        // Delete the MSEL
        const deleteButton = page.getByRole('button', { name: 'Delete this MSEL' });
        if (await deleteButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteButton.click();

          // Confirm deletion in the dialog
          await page.waitForTimeout(500);
          const confirmDialog = page.locator(
            '[role="dialog"], [class*="dialog"], [class*="modal"], .mat-dialog-container'
          ).first();
          if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
            const confirmButton = page.locator(
              'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes"), button:has-text("YES"), button:has-text("OK")'
            ).last();
            await confirmButton.click();

            // Wait for redirect back to MSEL list
            await expect(page).toHaveURL(/.*\/build$/, { timeout: 10000 });
          }
        }
      }

      uploadedMselName = null;
    }
  });

  test('Upload MSEL from File', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to MSELs list
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // First, download an existing MSEL xlsx so we have a valid file to upload
    // Per-row download buttons are named "Download [MSEL name]"
    const downloadButton = page.getByRole('button', { name: 'Download Standard MSEL' });
    await expect(downloadButton).toBeVisible({ timeout: 5000 });
    await downloadButton.click();

    // Download menu appears with xlsx/json options
    const downloadXlsxItem = page.getByRole('menuitem', { name: /xlsx/i });
    await expect(downloadXlsxItem).toBeVisible({ timeout: 5000 });

    const downloadPromise = page.waitForEvent('download');
    await downloadXlsxItem.click();
    const download = await downloadPromise;

    const downloadPath = path.join(os.tmpdir(), `msel-upload-test-${Date.now()}.xlsx`);
    await download.saveAs(downloadPath);

    // Get list of MSELs before upload to identify the new one
    const mselRowsBefore = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const mselNamesBefore = await mselRowsBefore.evaluateAll((rows) =>
      rows.slice(1).map(row => {
        const nameCell = row.querySelector('td:first-child a');
        return nameCell ? nameCell.textContent?.trim() : null;
      }).filter(Boolean)
    );

    // 2. Click 'Upload a new MSEL from a file' button in the header
    const uploadButton = page.getByRole('button', { name: 'Upload a new MSEL from a file' });
    await expect(uploadButton).toBeVisible({ timeout: 5000 });
    await uploadButton.click();

    // Upload menu appears with xlsx/json options
    const uploadXlsxItem = page.getByRole('menuitem', { name: /xlsx/i });
    await expect(uploadXlsxItem).toBeVisible({ timeout: 5000 });

    // Set up file chooser before clicking
    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadXlsxItem.click();

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(downloadPath);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // expect: The page still shows the MSEL list with entries
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Identify the newly uploaded MSEL by finding one that wasn't in the list before
    const mselRowsAfter = page.getByRole('row').filter({ hasNotText: 'Name Description Template Status Created By Date Created Date Modified' });
    const mselNamesAfter = await mselRowsAfter.evaluateAll((rows) =>
      rows.slice(1).map(row => {
        const nameCell = row.querySelector('td:first-child a');
        return nameCell ? nameCell.textContent?.trim() : null;
      }).filter(Boolean)
    );

    // Find the new MSEL (the one that exists after but not before)
    const newMsel = mselNamesAfter.find(name => !mselNamesBefore.includes(name));
    if (newMsel) {
      uploadedMselName = newMsel as string;
    }
  });
});
