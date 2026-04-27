// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Views', () => {
  test('Export View', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to admin views section
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Views list displays
    await expect(page.getByRole('heading', { name: 'Views' })).toBeVisible();

    // Select a view first
    const firstViewCheckbox = page.getByRole('row').nth(1).getByRole('checkbox');
    await firstViewCheckbox.click();
    await expect(firstViewCheckbox).toBeChecked();

    // 2. Click export button for a view (the export icon button)
    const exportButton = page.locator('button:has(mat-icon.mdi-file-export)');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // expect: Export dialog opens
    const exportDialog = page.getByRole('dialog');
    await expect(exportDialog).toBeVisible();

    // 3. Click Export button in the dialog to start the download
    const downloadPromise = page.waitForEvent('download');
    await exportDialog.getByRole('button', { name: /Export/ }).click();

    // expect: View data is exported
    // expect: Export file is downloaded
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });
});
