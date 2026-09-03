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
  // Registered as soon as the collection exists so `afterEach` removes it even when the
  // test body throws partway through.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId cascades on delete, so this removes the exhibit as well.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Edit Test collection');
    }
    collectionId = undefined;
  });

  test('Edit Existing Exhibit', async ({ galleryAuthenticatedPage: page }) => {
    // Both the collection and the exhibit are preconditions here — the subject under
    // test is the edit dialog, so seed them via the API.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Edit Test ${suffix}`);
    collectionId = collection.id;
    const testExhibitName = `Edit Exhibit ${suffix}`;
    const updatedExhibitName = `Updated ${testExhibitName}`;
    await apiCreateExhibit(collectionId, testExhibitName);

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collection.name);

    // 1. Click the Edit button (pencil icon) on the exhibit row
    const row = page.locator('tr.element-row').filter({ hasText: testExhibitName });
    await expect(row).toBeVisible();
    const editButton = row.getByRole('button', { name: `Edit ${testExhibitName}` });
    await expect(editButton).toBeEnabled();
    await editButton.click();

    // expect: Exhibit edit dialog opens
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByText('Edit Exhibit')).toBeVisible();

    // expect: Name is populated with the current value
    await expect(editDialog.getByLabel('Name')).toHaveValue(testExhibitName);

    // 2. Modify the exhibit name
    await editDialog.getByLabel('Name').fill(updatedExhibitName);

    // 3. Click 'Save' button
    await editDialog.getByRole('button', { name: 'Save' }).click();

    // expect: Exhibit is updated successfully and the dialog closes
    await expect(editDialog).not.toBeVisible();

    // expect: The renamed exhibit is shown and the old name is gone
    await expect(page.locator('tr.element-row').filter({ hasText: updatedExhibitName })).toBeVisible();
    await expect(
      page.locator('tr.element-row').filter({ hasText: new RegExp(`^\\s*${testExhibitName}`) })
    ).toHaveCount(0);
  });
});
