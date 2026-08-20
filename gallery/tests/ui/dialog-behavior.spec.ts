// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin, apiDeleteCollectionByName } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  // Names are registered before the record is created so the safety net below can
  // remove them even if the test throws mid-way. Only exact names created here are
  // deleted — sibling workers create their own collections concurrently.
  let createdNames: string[] = [];

  test.afterEach(async () => {
    for (const name of createdNames) {
      await apiDeleteCollectionByName(name);
    }
    createdNames = [];
  });

  test('Dialog and Modal Behavior', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // 1. Open a dialog (e.g., Add Collection)
    await page.getByRole('button', { name: 'Add Collection' }).click();

    // expect: Dialog appears as a modal overlay
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 2. Click the 'Cancel' button in the dialog (use last() to target the text Cancel button, not the X icon)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();

    // expect: Dialog closes without saving changes
    await expect(dialog).not.toBeVisible();

    // 3. Open a dialog, press the Escape key
    await page.getByRole('button', { name: 'Add Collection' }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');

    // expect: Dialog closes
    await expect(dialog).not.toBeVisible();

    // 4. Open a dialog, make changes, click 'Save'
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2).toBeVisible();

    const dialogCollectionName = `Dialog Test ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    createdNames.push(dialogCollectionName);
    await dialog2.getByLabel('Name').fill(dialogCollectionName);
    await dialog2.getByRole('button', { name: 'Save' }).click();

    // expect: Dialog processes the action and closes
    await expect(dialog2).not.toBeVisible();

    // Search for the newly created collection (handles pagination)
    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(dialogCollectionName);

    // expect: Changes are persisted
    await expect(page.getByText(dialogCollectionName)).toBeVisible();

    // Cleanup happens in afterEach so it still runs if an assertion above fails.
  });
});
