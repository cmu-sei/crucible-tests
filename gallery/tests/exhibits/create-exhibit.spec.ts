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
  // Registered the instant the collection exists so `afterEach` can remove it even if
  // the test body throws before finishing — never clean up inline at the end of a test.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId is configured with DeleteBehavior.Cascade (verified in
    // Gallery's EF model snapshot and by observing a 404 on GET /api/exhibits/{id}
    // after the parent collection is deleted), so this removes the exhibit too.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Create Test collection');
    }
    collectionId = undefined;
  });

  test('Create New Exhibit', async ({ galleryAuthenticatedPage: page }) => {
    // The parent collection is a precondition, not the subject under test — seed it
    // through the API instead of clicking through the create-collection dialog.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Create Test ${suffix}`);
    collectionId = collection.id;
    const testExhibitName = `Create Exhibit ${suffix}`;

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collection.name);

    // 1. Click 'Add Exhibit' button
    await page.getByRole('button', { name: 'Add Exhibit' }).click();

    // expect: An exhibit creation dialog opens with form fields
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Add Exhibit')).toBeVisible();

    // 2. Enter an exhibit name
    await dialog.getByLabel('Name').fill(testExhibitName);

    // 3. Click 'Save' button
    await dialog.getByRole('button', { name: 'Save' }).click();

    // expect: Exhibit is created successfully and the dialog closes
    await expect(dialog).not.toBeVisible();

    // expect: New exhibit appears in the list
    const newRow = page.locator('tr.element-row').filter({ hasText: testExhibitName });
    await expect(newRow).toBeVisible();
  });
});
