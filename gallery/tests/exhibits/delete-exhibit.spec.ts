// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiCreateCollection,
  apiCreateExhibit,
  apiDeleteCollectionById,
} from '../../fixtures';
import type { Page } from '@playwright/test';

async function selectCollection(page: Page, collectionName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  const option = page.getByRole('option', { name: collectionName });
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

test.describe('Exhibit Management', () => {
  // Registered as soon as the collection exists. Previously this spec deleted its
  // collection inline at the very end of the test body, so any earlier assertion
  // failure leaked the collection; an `afterEach` runs even when the body throws.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId cascades on delete, so this also removes any exhibit the
    // test failed to delete through the UI.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Delete Test collection');
    }
    collectionId = undefined;
  });

  test('Delete Exhibit', async ({ galleryAuthenticatedPage: page }) => {
    // Collection and exhibit are preconditions — the subject under test is the
    // exhibit delete-confirmation flow.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Delete Test ${suffix}`);
    collectionId = collection.id;
    const testExhibitName = `Delete Exhibit ${suffix}`;
    await apiCreateExhibit(collectionId, testExhibitName);

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collection.name);

    const row = page.locator('tr.element-row').filter({ hasText: testExhibitName });
    await expect(row).toBeVisible();

    // 1. Click the Delete button (trash icon) on the exhibit row
    await row.getByRole('button', { name: `Delete ${testExhibitName}` }).click();

    // expect: A confirmation dialog appears
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText('Delete Exhibit')).toBeVisible();

    // 2. Click 'Cancel' in the confirmation dialog
    await confirmDialog.getByRole('button', { name: 'Cancel' }).click();

    // expect: Dialog closes, exhibit is not deleted
    await expect(confirmDialog).not.toBeVisible();
    await expect(row).toBeVisible();

    // 3. Click Delete again and confirm
    await row.getByRole('button', { name: `Delete ${testExhibitName}` }).click();
    const confirmDialog2 = page.getByRole('dialog');
    await expect(confirmDialog2).toBeVisible();
    await confirmDialog2.getByRole('button', { name: 'Delete' }).click();

    // expect: The confirmation closes and the exhibit is removed from the list
    await expect(confirmDialog2).not.toBeVisible();
    await expect(row).toHaveCount(0);
  });
});
