// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  gotoAdminSection,
  apiDeleteCollectionById,
} from '../../fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Exhibit Management', () => {
  // The upload endpoint calls privateExhibitCopyAsync(..., copyTheCollection: true), so
  // it creates a brand-new collection (plus cards and articles) rather than reusing the
  // source one. That new collection is outside the worker-scoped `seededExhibit`
  // cleanup, so this spec must delete it itself — the previous version leaked an entire
  // collection tree on every run.
  let uploadedCollectionId: string | undefined;
  let tempPath: string | undefined;

  test.afterEach(async () => {
    if (uploadedCollectionId) {
      // Cascade removes the uploaded exhibit, teams, cards and articles.
      await apiDeleteCollectionById(uploadedCollectionId, 'uploaded exhibit collection');
      uploadedCollectionId = undefined;
    }
    if (tempPath) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        /* already gone */
      }
      tempPath = undefined;
    }
  });

  test('Upload Exhibit from JSON', async ({ galleryAuthenticatedPage: page, seededExhibit }) => {
    await gotoGalleryAdmin(page);
    await gotoAdminSection(page, 'Exhibits');

    // Select the worker-seeded collection so its exhibit can be exported.
    await page.getByRole('combobox', { name: 'Select a Collection' }).click();
    const seededOption = page.getByRole('option', { name: seededExhibit.collectionName });
    await expect(seededOption).toBeVisible({ timeout: 20000 });
    await seededOption.click();

    // The seeded exhibit's row appearing is what proves the table finished loading —
    // no fixed sleep needed.
    const seededRow = page.locator('tr.element-row').filter({ hasText: seededExhibit.exhibitName });
    await expect(seededRow).toBeVisible();

    // Produce the upload source by downloading the seeded exhibit's JSON export.
    const downloadPromise = page.waitForEvent('download');
    await seededRow.getByRole('button', { name: `Download ${seededExhibit.exhibitName}` }).click();
    const download = await downloadPromise;

    tempPath = path.join(
      os.tmpdir(),
      `gallery-exhibit-upload-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`
    );
    await download.saveAs(tempPath);

    // 1. Click the 'Upload Exhibit' button (upload icon) in the exhibits header
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Exhibit' }).click();

    // 2. Select a valid JSON exhibit file to upload. Pair the POST response wait with
    // the action so completion is proven by the response, not by a fixed sleep.
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/exhibits/json') && response.request().method() === 'POST',
      { timeout: 60000 }
    );
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(tempPath);

    // expect: The exhibit is imported successfully
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok()).toBe(true);
    const uploaded: { id: string; name: string; collectionId: string } = await uploadResponse.json();

    // Register the new collection for teardown immediately, before any assertion that
    // could throw and skip cleanup.
    uploadedCollectionId = uploaded.collectionId;

    // The import lands in a NEW collection, not the source one.
    expect(uploaded.id).not.toBe(seededExhibit.exhibitId);
    expect(uploaded.collectionId).not.toBe(seededExhibit.collectionId);
    // privateExhibitCopyAsync keeps the exhibit name and suffixes only the collection
    // name with " - <username>".
    expect(uploaded.name).toBe(seededExhibit.exhibitName);

    // expect: The new exhibit appears in the list.
    // selectFile() calls collectionDataService.setActive('') before uploading, which
    // clears the collection filter and hides the table, so select the newly created
    // collection to see the imported exhibit.
    const newCollectionName = `${seededExhibit.collectionName} - Admin User`;
    await page.getByRole('combobox', { name: 'Select a Collection' }).click();
    const newOption = page.getByRole('option', { name: newCollectionName });
    await expect(newOption).toBeVisible({ timeout: 20000 });
    await newOption.click();

    await expect(
      page.locator('tr.element-row').filter({ hasText: seededExhibit.exhibitName })
    ).toBeVisible();
  });
});
