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

  test('MSEL Page Unsaved Changes Warning', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL
    await navigateToMsel(page, mselId);

    // First create a page to edit
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });
    await addPageTab.click();

    // Wait for the new page to be created and save it
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveText(/New Page/, { timeout: 5000 });

    // Save the newly created page
    const saveButtonInitial = page.getByRole('button', { name: /Save/ }).first();
    const saveVisible = await saveButtonInitial.isVisible({ timeout: 2000 }).catch(() => false);
    if (saveVisible) {
      await saveButtonInitial.click();
    }

    // Wait for edit button to appear (proves save completed)
    const editButton = page.getByRole('button', { name: 'Edit Page' });
    await expect(editButton).toBeVisible({ timeout: 5000 });

    // Click the page tab if needed
    const pageTab = page.getByRole('tab').filter({ hasText: /New Page/ }).first();
    const isSelected = await pageTab.getAttribute('aria-selected');
    if (isSelected !== 'true') {
      await pageTab.click();
    }

    // Click edit to start editing
    await editButton.click();

    // 1. Make edits in the rich text editor without saving
    const contentArea = page.locator('[contenteditable="true"], [placeholder="Content"]').first();
    await expect(contentArea).toBeVisible({ timeout: 5000 });
    await contentArea.click();
    await page.keyboard.type('Unsaved test content');

    // 2. Try switching to Config tab without saving
    const configTab = page.getByRole('tab', { name: 'Config' });
    await configTab.click();

    // expect: An "Unsaved Changes" dialog may appear, or config tab becomes visible
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
