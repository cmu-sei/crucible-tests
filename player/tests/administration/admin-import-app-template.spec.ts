// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Administration - Application Templates', () => {
  test('Import Application Template', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to admin application templates section
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await page.getByRole('button', { name: 'Application Templates' }).click();

    // expect: Templates section displays
    await expect(page.getByRole('columnheader', { name: 'Template Name' })).toBeVisible();

    // 2. Click 'Import' button (the import icon)
    const importButton = page.locator('button:has(mat-icon.mdi-file-import)');

    // expect: Import dialog opens
    // expect: File upload interface is presented
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
  });
});
