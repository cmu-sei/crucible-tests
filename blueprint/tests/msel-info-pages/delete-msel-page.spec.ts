// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

test.describe('MSEL Info Pages Management', () => {
  test('Delete MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the build page and open a MSEL
    await page.goto(`${Services.Blueprint.UI}/build`);
    await page.waitForLoadState('networkidle');

    // Open an existing MSEL
    const mselLink = page.getByRole('link', { name: /Project Lagoon TTX/ }).first();
    await expect(mselLink).toBeVisible({ timeout: 10000 });
    await mselLink.click();
    await expect(page).toHaveURL(/.*\/build\?msel=.*/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // First, create a new page so we have one to safely delete
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });
    await addPageTab.click();
    await page.waitForLoadState('networkidle');

    // Verify new page was created and is selected
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveText(/New Page/, { timeout: 5000 });
    const newPageName = (await selectedTab.textContent())?.trim() || 'New Page';

    // The page is in edit mode after creation — we need to save or cancel first
    // Look for the cancel button (X icon) to exit edit mode
    const cancelButton = page.getByRole('button', { name: /Cancel/ }).first();
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
      await page.waitForTimeout(500);
    }

    // 1. Click the delete button for this page (button name is "Delete [page name]")
    const deleteButton = page.getByRole('button', { name: `Delete ${newPageName}` });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible({ timeout: 5000 });

    // 2. Confirm deletion
    const yesButton = confirmDialog.getByRole('button', { name: /YES/i });
    await expect(yesButton).toBeVisible({ timeout: 5000 });
    await yesButton.click();

    // expect: The page is deleted — the specific tab should no longer exist
    await page.waitForLoadState('networkidle');
    const deletedTab = page.getByRole('tab', { name: newPageName, exact: true });
    await expect(deletedTab).toBeHidden({ timeout: 10000 });

    // expect: Config tab is still visible
    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 5000 });
  });
});
