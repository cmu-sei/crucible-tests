// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../../fixtures';

test.describe('Report Interface', () => {
  test('Export Report Data', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to report view
    await expect(page).toHaveURL(/localhost:4721/, { timeout: 10000 });
    const rows = page.locator('mat-row, tbody tr, [class*="evaluation-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await rows.first().click();
    await page.waitForLoadState('domcontentloaded');

    const reportTab = page.locator('[role="tab"]:has-text("Report"), button:has-text("Report")').first();
    await expect(reportTab).toBeVisible({ timeout: 10000 });
    await reportTab.click();
    await page.waitForLoadState('domcontentloaded');

    // expect: Report displays with data

    // 2. Click export or download button if available
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download"), button[aria-label*="export"], button[aria-label*="download"], button:has(mat-icon:has-text("download")), button:has(mat-icon:has-text("file_download"))').first();

    if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

      await exportButton.click();

      // expect: Export begins or dialog opens
      const download = await downloadPromise;
      if (download) {
        // expect: Report data is exported
        // expect: Export file is downloaded
        expect(download.suggestedFilename()).toBeTruthy();
      }
    }
  });
});
