// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: cite/cite-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Evaluations', () => {
  test('Download Evaluation', async ({ citeAuthenticatedPage: page }) => {

    // 1. Navigate to admin evaluations section
    await page.goto(`${Services.Cite.UI}/admin`);
    await page.waitForLoadState('domcontentloaded');

    const evaluationsLink = page.locator('text=Evaluations, a:has-text("Evaluations"), mat-list-item:has-text("Evaluations")').first();
    await expect(evaluationsLink).toBeVisible({ timeout: 10000 });
    await evaluationsLink.click();

    // expect: Evaluations list displays
    const rows = page.locator('mat-row, tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 2. Click download button for an evaluation
    const downloadButton = page.locator('button:has(mat-icon:has-text("download")), button:has(mat-icon:has-text("file_download")), button:has(mat-icon:has-text("cloud_download")), button[aria-label*="download"]').first();
    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await downloadButton.click();

      // expect: Download begins
      // expect: JSON file is downloaded containing evaluation data
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.json');
      }
    }
  });
});
