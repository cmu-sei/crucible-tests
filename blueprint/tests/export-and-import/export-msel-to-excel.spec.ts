// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import fs from 'fs';

test.describe('Export and Import', () => {
  test('Export MSEL to Excel', async ({ blueprintAuthenticatedPage: page }) => {

    // 1. Navigate to the MSEL list page
    await expect(page).toHaveURL(/.*localhost:4725.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Click "Manage an Event" button to navigate to MSEL list
    const manageEventButton = page.getByRole('button', { name: /Manage an Event/i });
    await expect(manageEventButton).toBeVisible({ timeout: 5000 });
    await manageEventButton.click();

    // Wait for MSEL list page to load
    await expect(page).toHaveURL(/.*localhost:4725\/build.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // expect: MSEL list is displayed with system MSELs
    await expect(page.getByRole('link', { name: 'Standard MSEL' }).first()).toBeVisible({ timeout: 5000 });

    // 2. Click 'Download' button for Standard MSEL
    const downloadButton = page.getByRole('button', { name: 'Download Standard MSEL' }).first();
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    // Start waiting for download before opening menu
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.click();

    // Wait for the download menu to appear and click xlsx option
    const xlsxOption = page.getByRole('menuitem', { name: /Download xlsx file/i });
    await expect(xlsxOption).toBeVisible({ timeout: 3000 });
    await xlsxOption.click();

    // expect: Excel file is generated and downloaded
    const download = await downloadPromise;
    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);

    // expect: Excel file contains MSEL details and scenario events
    if (downloadPath) {
      const stats = fs.statSync(downloadPath);
      expect(stats.size).toBeGreaterThan(0);

      // Clean up
      fs.unlinkSync(downloadPath);
    }
  });
});
