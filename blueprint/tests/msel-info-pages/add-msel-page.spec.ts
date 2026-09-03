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

  test('Add MSEL Page', async ({ blueprintAuthenticatedPage: page }) => {
    // Navigate to the seeded MSEL
    await navigateToMsel(page, mselId);

    // 1. Click the 'Add Page' tab (plus icon at end of tabs)
    const addPageTab = page.getByRole('tab', { name: 'Add Page' });
    await expect(addPageTab).toBeVisible({ timeout: 5000 });
    await addPageTab.click();

    // expect: A new page is created with a default name like 'New Page' or 'New Page N'
    // The new page tab should be selected (active)
    const selectedTab = page.getByRole('tab', { selected: true });
    await expect(selectedTab).toHaveText(/New Page/, { timeout: 5000 });

    // expect: The page name input is visible and editable
    const pageNameInput = page.getByRole('textbox').first();
    await expect(pageNameInput).toBeVisible({ timeout: 5000 });

    // expect: The rich text editor toolbar is displayed (with Bold, Italic, etc.)
    const boldButton = page.getByRole('button', { name: 'Bold' });
    await expect(boldButton).toBeVisible({ timeout: 5000 });

    // expect: The content area is visible for editing
    const contentArea = page.locator('[contenteditable="true"], [placeholder="Content"]').first();
    await expect(contentArea).toBeVisible({ timeout: 5000 });

    // 2. Verify save/cancel buttons are available
    const saveButton = page.locator('button:has(mat-icon)').first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
  });
});
