// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect } from '@playwright/test';
import { authenticateGalleryWithKeycloak } from '../../fixtures';

test.describe('Edge Cases and Negative Testing', () => {
  test('Special Characters and Input Sanitization', async ({ page }) => {
    await authenticateGalleryWithKeycloak(page);
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page).toHaveTitle('Gallery Admin');

    // 1. Create a collection with special characters in the name
    const xssName = `<script>alert('xss')</script> ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Collection' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(xssName);
    await dialog.getByLabel('Description').fill('<b>HTML tags</b>');
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close after save
    await expect(dialog).not.toBeVisible();

    // expect: Special characters are handled correctly
    // expect: No XSS vulnerabilities - name is stored and displayed properly escaped
    // Search for the newly created collection to verify it's visible
    await page.getByRole('textbox', { name: 'Search' }).fill(xssName);
    await expect(page.getByText(xssName)).toBeVisible();

    // 2. Create a collection with Unicode characters
    const unicodeName = `Unicode 测试 🎯 ${Date.now()}`;
    await page.getByRole('button', { name: 'Add Collection' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Name').fill(unicodeName);
    await dialog.getByLabel('Description').fill('Unicode test');
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Wait for dialog to close after save
    await expect(dialog).not.toBeVisible();

    // expect: Unicode characters are stored and displayed correctly
    // Note: Due to table pagination, the collection might be on a different page
    // Search for it to bring it into view
    await page.getByRole('textbox', { name: 'Search' }).fill(unicodeName);
    await expect(page.getByText(unicodeName)).toBeVisible({ timeout: 15000 });

    // Cleanup: Delete both collections
    for (const name of [unicodeName, xssName]) {
      // Search for the collection using full name to ensure uniqueness
      await page.getByRole('textbox', { name: 'Search' }).clear();
      await page.getByRole('textbox', { name: 'Search' }).fill(name);

      // Wait for the specific row to appear (using full name for uniqueness)
      const row = page.getByRole('row').filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: 5000 });

      const deleteBtn = row.getByRole('button', { name: /Delete/ });
      await deleteBtn.click();

      // Wait for confirmation dialog to be fully visible and stable
      const confirmDialog = page.getByRole('dialog');
      await expect(confirmDialog).toBeVisible();

      // Wait for the confirm button to be actionable (not blocked by backdrop)
      const confirmButton = confirmDialog.getByRole('button', { name: /yes|confirm|ok|delete/i });
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      // Wait for dialog to close
      await expect(confirmDialog).not.toBeVisible();
    }

    // Clear search to verify deletions
    await page.getByRole('textbox', { name: 'Search' }).clear();
  });
});
