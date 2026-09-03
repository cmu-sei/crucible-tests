// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoGalleryAdmin,
  apiCreateCollection,
  apiDeleteCollectionByName,
  Services,
} from '../../fixtures';
import { request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Collection Management', () => {
  // Names to remove in teardown: the seeded source collection and the collection the
  // upload creates.
  let createdCollectionNames: string[] = [];
  let tempFiles: string[] = [];

  test.beforeEach(() => {
    createdCollectionNames = [];
    tempFiles = [];
  });

  test.afterEach(async () => {
    for (const name of createdCollectionNames) {
      await apiDeleteCollectionByName(name);
    }
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
    }
  });

  test('Upload Collection from JSON', async ({ galleryAuthenticatedPage: page }) => {
    const sourceName = `Upload Test Collection ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    // UploadJsonAsync reuses privateCollectionCopyAsync, which renames the imported
    // collection to `<original name> - <current user name>`.
    const expectedUploadedName = `${sourceName} - Admin User`;

    // Seed our own source collection instead of depending on whatever row happens to
    // be first in the (paginated) list.
    createdCollectionNames.push(sourceName, expectedUploadedName);
    await apiCreateCollection(sourceName, 'Collection for upload test');

    await gotoGalleryAdmin(page);

    const searchField = page.getByRole('textbox', { name: 'Search' });
    await searchField.fill(sourceName);
    const sourceRow = page.getByRole('row').filter({ hasText: sourceName });
    await expect(sourceRow).toHaveCount(1);

    // Download the seeded collection to use as the upload source
    const downloadPromise = page.waitForEvent('download');
    await sourceRow.getByRole('button', { name: `Download ${sourceName}` }).click();
    const download = await downloadPromise;

    // Save the downloaded file
    const tempPath = path.join(
      os.tmpdir(),
      `gallery-upload-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`
    );
    tempFiles.push(tempPath);
    await download.saveAs(tempPath);
    expect(fs.statSync(tempPath).size).toBeGreaterThan(0);

    // Capture the source collection's contents to compare against the uploaded copy.
    const originalFile = JSON.parse(fs.readFileSync(tempPath, 'utf8'));
    const originalCardCount = originalFile.Cards.$values.length;
    const originalArticleCount = originalFile.Articles.$values.length;

    // 1. Click the 'Upload Collection' button (upload icon) in the collections header
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Upload Collection' }).click();

    // 2. Select a valid JSON collection file to upload
    const fileChooser = await fileChooserPromise;
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/collections/json') && response.request().method() === 'POST'
    );
    await fileChooser.setFiles(tempPath);

    // expect: The collection is imported successfully
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(200);
    const createdCollection = await uploadResponse.json();
    expect(createdCollection.name).toBe(expectedUploadedName);

    // expect: The new collection appears in the list
    await searchField.fill(expectedUploadedName);
    await expect(page.getByRole('row').filter({ hasText: expectedUploadedName })).toHaveCount(1);

    // expect: The uploaded copy carries the same card/article counts as the source.
    const apiContext = await pwRequest.newContext({ ignoreHTTPSErrors: true });
    try {
      const tokenResponse = await apiContext.post(
        `${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`,
        {
          form: {
            grant_type: 'password',
            client_id: 'gallery.ui',
            username: 'admin',
            password: 'admin',
            scope: 'openid profile gallery',
          },
        }
      );
      expect(tokenResponse.ok()).toBeTruthy();
      const token = (await tokenResponse.json()).access_token as string;

      const articlesResponse = await apiContext.get(
        `${Services.Gallery.API}/api/collections/${createdCollection.id}/articles`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(articlesResponse.ok()).toBeTruthy();
      const cardsResponse = await apiContext.get(
        `${Services.Gallery.API}/api/collections/${createdCollection.id}/cards`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      expect(cardsResponse.ok()).toBeTruthy();

      const articles = await articlesResponse.json();
      const cards = await cardsResponse.json();
      expect(articles).toHaveLength(originalArticleCount);
      expect(cards).toHaveLength(originalCardCount);
    } finally {
      await apiContext.dispose();
    }
    // Cleanup is handled by the afterEach hook (apiDeleteCollectionByName + temp files).
  });
});
