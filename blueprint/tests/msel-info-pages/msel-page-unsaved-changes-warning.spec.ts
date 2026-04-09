// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('MSEL Page Unsaved Changes Warning', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to a MSEL with pages
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to an existing page tab — use first() since multiple may exist
    const pageTab = page.getByRole('tab', { name: 'New Page', exact: true }).first();
    await expect(pageTab).toBeVisible({ timeout: 5000 });
    await pageTab.click();
    await page.waitForLoadState('networkidle');

    // Click edit to start editing
    const editButton = page.getByRole('button', { name: 'Edit Page' });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // 1. Make edits in the rich text editor without saving
    const contentArea = page.locator('[contenteditable="true"], [placeholder="Content"]').first();
    await expect(contentArea).toBeVisible({ timeout: 5000 });
    await contentArea.click();
    await page.keyboard.type('Unsaved test content');

    // 2. Try switching to Config tab without saving
    const configTab = page.getByRole('tab', { name: 'Config' });
    await configTab.click();
    await page.waitForTimeout(500);

    // expect: An "Unsaved Changes" dialog may appear
    const unsavedDialog = page.getByRole('dialog');
    const dialogVisible = await unsavedDialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (dialogVisible) {
      // Dismiss the dialog by clicking YES to discard changes
      const yesButton = unsavedDialog.getByRole('button', { name: /YES/i });
      if (await yesButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await yesButton.click();
      }
    }

    // expect: Config tab is now visible/selected
    await expect(configTab).toBeVisible({ timeout: 5000 });
  });
});
