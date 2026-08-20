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
  let collectionId: string | undefined;

  test.afterEach(async () => {
    // Exhibit.CollectionId cascades on delete, so this removes the exhibit too.
    if (collectionId) {
      await apiDeleteCollectionById(collectionId, 'Exhibit Download Test collection');
    }
    collectionId = undefined;
  });

  test('Download Exhibit as JSON', async ({ galleryAuthenticatedPage: page }) => {
    // Collection and exhibit are preconditions — the download button is the subject.
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const collection = await apiCreateCollection(`Exhibit Download Test ${suffix}`);
    collectionId = collection.id;
    const testExhibitName = `Download Exhibit ${suffix}`;
    await apiCreateExhibit(collectionId, testExhibitName);

    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, collection.name);

    const row = page.locator('tr.element-row').filter({ hasText: testExhibitName });
    await expect(row).toBeVisible();

    // 1. Click the Download button (download icon) on the exhibit row
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: `Download ${testExhibitName}` }).click();

    // expect: A JSON file download begins
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    // expect: The downloaded payload is the exhibit's JSON export, so it must parse and
    // carry this exhibit's name.
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(JSON.stringify(payload)).toContain(testExhibitName);
  });
});
