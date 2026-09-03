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
import type { Download, Locator, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Read a download into memory and parse it as the Gallery export format.
 *
 * The API serializes with `ReferenceHandler.Preserve`, so every collection in the
 * payload is wrapped as `{ "$values": [...] }` — hence the unwrapping helper below.
 */
async function readJsonDownload(download: Download): Promise<any> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function values(node: any): any[] {
  return node?.$values ?? [];
}

function namesOf(node: any): string[] {
  return values(node)
    .map((item: any) => item.Name as string)
    .sort();
}

async function saveToTemp(download: Download, label: string): Promise<string> {
  const target = path.join(os.tmpdir(), `gallery-roundtrip-${label}-${Date.now()}.json`);
  await download.saveAs(target);
  return target;
}

/**
 * Pick a collection in the Exhibits admin picker.
 *
 * `exact` matters: the upload copies are named "<original> - Admin User", so a
 * substring match on the original name resolves to both the original and its copy.
 */
async function selectCollection(page: Page, collectionName: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Select a Collection' }).click();
  const option = page.getByRole('option', { name: collectionName, exact: true });
  await expect(option).toBeVisible({ timeout: 20000 });
  await option.click();
}

/**
 * Filter the admin Collections list to one collection and return its row.
 *
 * Searching first is required — the list paginates at 10 and concurrent specs seed
 * their own collections, so a freshly-created row routinely lands on page 2+. The row
 * is then pinned by an exact name-cell match for the same reason as above: the search
 * term "X" also matches "X - Admin User".
 */
async function findCollectionRow(page: Page, name: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  await searchField.clear();
  await searchField.fill(name);
  const row = page
    .locator('app-admin-collections tr.element-row')
    .filter({ has: page.getByRole('cell', { name, exact: true }) });
  await expect(row).toBeVisible();
  return row;
}

test.describe('Edge Cases and Negative Testing', () => {
  // Every collection this test causes to exist is registered here and removed in
  // afterEach. Importantly that includes the collections the *uploads* create:
  // CollectionService.UploadJsonAsync and ExhibitService.UploadJsonAsync both route
  // through a private copy helper (`copyTheCollection: true` for the exhibit case), so
  // each upload mints a brand-new collection — named "<original> - <username>" — which
  // nothing else in the suite would ever clean up.
  const collectionIdsToDelete: string[] = [];
  const tempFiles: string[] = [];

  test.afterEach(async () => {
    while (collectionIdsToDelete.length > 0) {
      const id = collectionIdsToDelete.pop() as string;
      await apiDeleteCollectionById(id, 'Download/Upload roundtrip collection');
    }
    while (tempFiles.length > 0) {
      const file = tempFiles.pop() as string;
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
    }
  });

  // Plan steps 1-4 cover both the collection round trip (1-2) and the exhibit round
  // trip (3-4). They stay in separate tests because both the collection import and the
  // exhibit import mint a copy collection named "<original> - Admin User", so running
  // all four steps in one test would leave two identically-named collections in the
  // picker at once and no locator could tell them apart. One copy per test keeps every
  // lookup unambiguous, and afterEach removes it before the next test starts.
  test('Collection Download Upload Round Trip', async ({
    galleryAuthenticatedPage: page,
    seededExhibit,
  }) => {
    // `seededExhibit` gives a collection with 3 cards and 6 articles plus an exhibit
    // with a team — enough structure that "matches the original" is a real assertion.
    // It is worker-scoped and cleaned up by the fixture; only the upload-created
    // collections are this test's responsibility.
    await gotoGalleryAdmin(page);

    // 1. Download a collection as JSON
    const collectionRow = await findCollectionRow(page, seededExhibit.collectionName);
    const collectionDownloadPromise = page.waitForEvent('download');
    await collectionRow
      .getByRole('button', { name: `Download ${seededExhibit.collectionName}` })
      .click();
    const collectionDownload = await collectionDownloadPromise;

    // expect: JSON file is downloaded successfully
    expect(collectionDownload.suggestedFilename()).toMatch(/\.json$/);
    const originalCollectionJson = await readJsonDownload(collectionDownload);
    expect(originalCollectionJson.Collection.Name).toBe(seededExhibit.collectionName);
    const originalCardNames = namesOf(originalCollectionJson.Cards);
    const originalArticleNames = namesOf(originalCollectionJson.Articles);
    expect(originalCardNames.length).toBeGreaterThan(0);
    expect(originalArticleNames.length).toBeGreaterThan(0);

    // expect: the file really is the collection's content, not an empty shell.
    expect(originalCollectionJson.Collection.Description).toBe(
      'Auto-seeded collection for Playwright tests'
    );

    const collectionFile = await saveToTemp(collectionDownload, 'collection');
    tempFiles.push(collectionFile);

    // 2. Upload the same JSON file as a new collection.
    // Pair the file-chooser with the POST rather than sleeping: the response both
    // proves the upload finished and hands back the new collection's id, which is the
    // only reliable way to clean it up (the copy is renamed, so a name-prefix purge
    // would miss it).
    const collectionUpload = page.waitForResponse(
      (response) =>
        response.url().includes('/collections/json') && response.request().method() === 'POST'
    );
    const collectionChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Collection' }).click();
    (await collectionChooserPromise).setFiles(collectionFile);

    const collectionUploadResponse = await collectionUpload;
    // Surface the server's ProblemDetails in the failure message. POST /api/collections/json
    // occasionally 500s under concurrent load, and the status alone gives nothing to
    // diagnose from.
    expect(
      collectionUploadResponse.status(),
      `POST /api/collections/json failed: ${await collectionUploadResponse.text()}`
    ).toBe(200);
    const uploadedCollection = await collectionUploadResponse.json();
    collectionIdsToDelete.push(uploadedCollection.id);

    // expect: A new collection is created from the uploaded file — a distinct record,
    // not a mutation of the original. `privateCollectionCopyAsync` appends " - <user>"
    // to the name.
    expect(uploadedCollection.id).not.toBe(seededExhibit.collectionId);
    expect(uploadedCollection.name).toBe(`${seededExhibit.collectionName} - Admin User`);

    // ...and it shows up in the admin list.
    const uploadedRow = await findCollectionRow(page, uploadedCollection.name);
    await expect(uploadedRow.getByRole('cell').nth(1)).toHaveText(uploadedCollection.name);

    // expect: The new collection matches the original in structure and content —
    // download the copy and compare its cards and articles to the original's.
    const copyDownloadPromise = page.waitForEvent('download');
    await uploadedRow.getByRole('button', { name: `Download ${uploadedCollection.name}` }).click();
    const copyJson = await readJsonDownload(await copyDownloadPromise);
    expect(namesOf(copyJson.Cards)).toEqual(originalCardNames);
    expect(namesOf(copyJson.Articles)).toEqual(originalArticleNames);
    expect(copyJson.Collection.Description).toBe(originalCollectionJson.Collection.Description);
  });

  test('Exhibit Download Upload Round Trip', async ({
    galleryAuthenticatedPage: page,
    seededExhibit,
  }) => {
    await gotoGalleryAdmin(page);

    // The exhibit export embeds the collection's cards, so capture the original card
    // names from the collection export to compare against after the import.
    const collectionRow = await findCollectionRow(page, seededExhibit.collectionName);
    const collectionDownloadPromise = page.waitForEvent('download');
    await collectionRow
      .getByRole('button', { name: `Download ${seededExhibit.collectionName}` })
      .click();
    const originalCardNames = namesOf((await readJsonDownload(await collectionDownloadPromise)).Cards);
    expect(originalCardNames.length).toBeGreaterThan(0);

    // 3. Download an exhibit as JSON
    await gotoAdminSection(page, 'Exhibits');
    await selectCollection(page, seededExhibit.collectionName);
    const exhibitRow = page
      .locator('app-admin-exhibits tr.element-row')
      .filter({ hasText: seededExhibit.exhibitName });
    await expect(exhibitRow).toBeVisible();

    const exhibitDownloadPromise = page.waitForEvent('download');
    await exhibitRow.getByRole('button', { name: `Download ${seededExhibit.exhibitName}` }).click();
    const exhibitDownload = await exhibitDownloadPromise;

    // expect: JSON file is downloaded successfully
    expect(exhibitDownload.suggestedFilename()).toMatch(/\.json$/);
    const originalExhibitJson = await readJsonDownload(exhibitDownload);
    expect(originalExhibitJson.Exhibit.Name).toBe(seededExhibit.exhibitName);
    const originalTeamNames = namesOf(originalExhibitJson.Teams);
    expect(originalTeamNames).toContain(seededExhibit.teamName);

    const exhibitFile = await saveToTemp(exhibitDownload, 'exhibit');
    tempFiles.push(exhibitFile);

    // 4. Upload the same JSON file as a new exhibit
    const exhibitUpload = page.waitForResponse(
      (response) =>
        response.url().includes('/exhibits/json') && response.request().method() === 'POST'
    );
    const exhibitChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Exhibit' }).click();
    (await exhibitChooserPromise).setFiles(exhibitFile);

    const exhibitUploadResponse = await exhibitUpload;
    expect(
      exhibitUploadResponse.status(),
      `POST /api/exhibits/json failed: ${await exhibitUploadResponse.text()}`
    ).toBe(200);
    const uploadedExhibit = await exhibitUploadResponse.json();

    // The exhibit import copies the collection as well (`copyTheCollection: true`), so
    // the new parent collection is the thing to delete — it cascades to the exhibit.
    expect(uploadedExhibit.collectionId).not.toBe(seededExhibit.collectionId);
    collectionIdsToDelete.push(uploadedExhibit.collectionId);

    // expect: A new exhibit is created from the uploaded file
    expect(uploadedExhibit.id).not.toBe(seededExhibit.exhibitId);
    expect(uploadedExhibit.name).toBe(seededExhibit.exhibitName);

    // expect: The new exhibit matches the original — same name and description, move
    // and inject reset to the start, and the teams came across. Verified by downloading
    // the copy through the UI's own picker, which also proves the new collection and
    // exhibit are browsable.
    const copiedCollectionName = `${seededExhibit.collectionName} - Admin User`;
    await selectCollection(page, copiedCollectionName);
    const copiedExhibitRow = page
      .locator('app-admin-exhibits tr.element-row')
      .filter({ hasText: seededExhibit.exhibitName });
    await expect(copiedExhibitRow).toBeVisible();

    const copiedExhibitDownloadPromise = page.waitForEvent('download');
    await copiedExhibitRow
      .getByRole('button', { name: `Download ${seededExhibit.exhibitName}` })
      .click();
    const copiedExhibitJson = await readJsonDownload(await copiedExhibitDownloadPromise);
    expect(copiedExhibitJson.Exhibit.Name).toBe(originalExhibitJson.Exhibit.Name);
    expect(copiedExhibitJson.Exhibit.Description).toBe(originalExhibitJson.Exhibit.Description);
    expect(copiedExhibitJson.Exhibit.CurrentMove).toBe(0);
    expect(copiedExhibitJson.Exhibit.CurrentInject).toBe(0);
    expect(namesOf(copiedExhibitJson.Teams)).toEqual(originalTeamNames);
    expect(namesOf(copiedExhibitJson.Cards)).toEqual(originalCardNames);
  });
});
