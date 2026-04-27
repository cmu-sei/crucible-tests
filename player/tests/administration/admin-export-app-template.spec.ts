// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Export Application Template', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to admin application templates section
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: Templates list displays
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // Select a template
    const firstCheckbox = page.getByRole('row').nth(1).getByRole('checkbox');
    await firstCheckbox.click();

    // 2. Click export button for a template
    const exportButton = page.locator('button:has(mat-icon.mdi-file-export)');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // expect: Export dialog opens
    const exportDialog = page.getByRole('dialog');
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.getByRole('heading', { name: 'Export Application Templates' })).toBeVisible();

    // 3. Click Export button in the dialog to start the download
    const downloadPromise = page.waitForEvent('download');
    await exportDialog.getByRole('button', { name: /Export/ }).click();

    // expect: Template file is downloaded
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });
});
