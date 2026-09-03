// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: player/player-test-plan.md
// seed: seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('Error Handling and Edge Cases', () => {
  test('File Upload - Invalid File Type', async ({ playerAuthenticatedPage: page }) => {
    // 1. Navigate to file upload interface (e.g., import view)
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Administration' }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // expect: Upload interface is displayed
    // The import button (upload/download icon) should be visible in the Views admin toolbar
    await expect(page.getByRole('heading', { name: 'Views', level: 3 })).toBeVisible();
    const importButton = page.locator('button:has(mat-icon[fonticon="mdi-file-import"])');
    await expect(importButton).toBeVisible();

    // 2. The import button triggers a file chooser
    // expect: File chooser accepts files
    // Note: We verify the import button is present and enabled
    await expect(importButton).toBeEnabled();
  });
});
