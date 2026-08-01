// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md

import { test, expect, Services } from '../../fixtures';
import {
  getBlueprintToken,
  createMsel,
  deleteMsel,
  navigateToMsel,
} from '../../test-helpers';

test.describe('MSEL Info Pages Management', () => {
  let token: string;
  let mselId: string;

  test.beforeEach(async () => {
    token = await getBlueprintToken();
    const msel = await createMsel(token);
    mselId = msel.id;
  });

  test.afterEach(async () => {
    try {
      if (mselId) await deleteMsel(token, mselId);
    } catch (err) {
      console.warn(`Cleanup failed for MSEL ${mselId}: ${err}`);
    }
  });

  test('Delete MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL
    await navigateToMsel(page, mselId);

    // First, create a new page so we have one to safely delete
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });
    await addPageTab.click();

    // Verify new page was created and is selected
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveText(/New Page/, { timeout: 5000 });
    const newPageName = (await selectedTab.textContent())?.trim() || 'New Page';

    // The page is in edit mode after creation — we need to save or cancel first
    // Look for the cancel button to exit edit mode
    const cancelButton = page.getByRole('button', { name: /Cancel/ }).first();
    if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelButton.click();
    }

    // Wait for delete button to become visible (proves edit mode exited)
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
    const deletedTab = page.getByRole('tab', { name: newPageName, exact: true });
    await expect(deletedTab).toBeHidden({ timeout: 10000 });

    // expect: Config tab is still visible
    const configTab = page.getByRole('tab', { name: 'Config' });
    await expect(configTab).toBeVisible({ timeout: 5000 });
  });
});
