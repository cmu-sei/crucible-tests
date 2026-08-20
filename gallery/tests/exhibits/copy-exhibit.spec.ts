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
  // Registered as soon as the collection exists. The old version of this spec deleted
  // the original, the copy, and the collection inline at the end of the test body, so
  // any earlier failure leaked all three; `afterEach` runs even when the body throws.
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId cascades on delete, so removing the collection removes both
    // the original exhibit and its copy in one call.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Copy Test collection');
    }
    collectionId = undefined;
  });

  test('Copy Exhibit', async ({ galleryAuthenticatedPage: page }) => {
    // Collection and source exhibit are preconditions — the copy button is the subject.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Copy Test ${suffix}`);
    collectionId = collection.id;
    const testExhibitName = `Copy Exhibit ${suffix}`;
    const original = await apiCreateExhibit(collectionId, testExhibitName);

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collection.name);

    const matchingRows = page.locator('tr.element-row').filter({ hasText: testExhibitName });
    await expect(matchingRows).toHaveCount(1);

    // 1. Click the Copy button (clipboard icon) on the exhibit row
    // ExhibitService.CopyAsync -> privateExhibitCopyAsync(..., copyTheCollection: false)
    // reuses the source exhibit's Name and CollectionId verbatim (only the collection
    // name gets a " - <username>" suffix, and only on the upload path). So the copy is a
    // second row with the SAME name in the SAME collection, with move/inject reset to 0.
    const copyResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/exhibits/${original.id}/copy`) && response.request().method() === 'POST'
    );
    await matchingRows.getByRole('button', { name: `Copy ${testExhibitName}` }).click();

    // expect: A new exhibit is created as a copy of the original
    const copyResponse = await copyResponsePromise;
    expect(copyResponse.status()).toBe(201);
    const copy: { id: string; name: string; collectionId: string; currentMove: number; currentInject: number } =
      await copyResponse.json();

    expect(copy.id).not.toBe(original.id);
    expect(copy.name).toBe(testExhibitName);
    expect(copy.collectionId).toBe(collectionId);
    expect(copy.currentMove).toBe(0);
    expect(copy.currentInject).toBe(0);

    // expect: The copied exhibit appears in the list alongside the original
    await expect(matchingRows).toHaveCount(2);
  });
});
