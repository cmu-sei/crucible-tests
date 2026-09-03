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
  Services,
} from '../../fixtures';
import { request as pwRequest, type APIRequestContext, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Edge Cases §15.4 — Invalid Upload Files.
 *
 * The contract this spec pins, on both the server and the client side:
 *
 *  - Server side, `CollectionService.UploadJsonAsync` / `ExhibitService.UploadJsonAsync` wrap
 *    `JsonSerializer.Deserialize` in a try/catch and throw a `BadRequestException` on
 *    `JsonException`, so a non-JSON or truncated file gets a **400** response rather than an
 *    unhandled 500. Verified live against both endpoints — the same message covers both a
 *    non-JSON file and structurally-broken JSON, since both raise `JsonException`:
 *      HTTP 400 {"title":"The uploaded file is not valid JSON.","status":400}
 *  - Client side, `uploadJson` in `collection-data.service.ts` / `exhibit-data.service.ts`
 *    opens a `MatSnackBar` on the error callback reading
 *    `err?.error?.detail || err?.error?.title || 'The uploaded file could not be processed.'`.
 *    The 400 body above has no `detail`, so the snackbar falls through to `title`.
 *
 * So: the payload is rejected with 400, the app surfaces an error notification naming the
 * problem, no record is created, and the UI recovers to an interactive state.
 *
 * Fixture files are written under `os.tmpdir()` and removed in teardown so nothing is
 * scratched into the repo.
 */

const INVALID_JSON_MESSAGE = 'The uploaded file is not valid JSON.';

/** Run a callback with a Gallery API context and an admin bearer token. */
async function galleryApi<T>(fn: (ctx: APIRequestContext, token: string) => Promise<T>): Promise<T> {
  const ctx = await pwRequest.newContext({ ignoreHTTPSErrors: true });
  try {
    const tokenRes = await ctx.post(`${Services.Keycloak}/realms/crucible/protocol/openid-connect/token`, {
      form: {
        grant_type: 'password',
        client_id: 'gallery.ui',
        username: 'admin',
        password: 'admin',
        scope: 'openid profile gallery',
      },
    });
    if (!tokenRes.ok()) {
      throw new Error(`Failed to get Gallery API token: ${tokenRes.status()} ${await tokenRes.text()}`);
    }
    return await fn(ctx, (await tokenRes.json()).access_token);
  } finally {
    await ctx.dispose();
  }
}

/**
 * Names of every collection currently known to the API.
 *
 * Used to prove a rejected upload created nothing. Checked against exact names this
 * spec's fixtures would have produced, so concurrent seeding by sibling specs cannot
 * make it flaky.
 */
async function apiCollectionNames(): Promise<string[]> {
  return await galleryApi(async (ctx, token) => {
    const res = await ctx.get(`${Services.Gallery.API}/api/collections`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok()) {
      throw new Error(`Failed to list collections: ${res.status()} ${await res.text()}`);
    }
    const collections: Array<{ name: string }> = await res.json();
    return collections.map((c) => c.name);
  });
}

test.describe('Edge Cases and Negative Testing', () => {
  let tempFiles: string[] = [];
  // Collection ids to remove. Only populated if an upload unexpectedly *succeeds* —
  // registered before the upload so a surprise success can never leak a record.
  let createdCollectionIds: string[] = [];

  test.beforeEach(() => {
    tempFiles = [];
    createdCollectionIds = [];
  });

  test.afterEach(async () => {
    for (const id of createdCollectionIds) {
      await apiDeleteCollectionById(id, 'invalid-upload collection');
    }
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        /* already gone */
      }
    }
  });

  /** Write a fixture file into the OS temp dir and register it for teardown. */
  function writeTempFile(suffix: string, contents: string): string {
    const filePath = path.join(
      os.tmpdir(),
      `gallery-invalid-upload-${Date.now()}-${Math.floor(Math.random() * 1e6)}-${suffix}`
    );
    tempFiles.push(filePath);
    fs.writeFileSync(filePath, contents, 'utf8');
    return filePath;
  }

  /**
   * Click `buttonName`, feed `filePath` to the resulting file chooser, and return the
   * upload response. The response wait is armed before the file is set so the POST can
   * never be missed, and awaiting it is what proves the upload finished — no sleep.
   */
  async function uploadFile(page: Page, buttonName: string, urlFragment: string, filePath: string) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: buttonName }).click();
    const fileChooser = await fileChooserPromise;

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(urlFragment) && r.request().method() === 'POST',
      { timeout: 60000 }
    );
    await fileChooser.setFiles(filePath);
    return await responsePromise;
  }

  test('Invalid Upload Files', async ({ galleryAuthenticatedPage: page }) => {
    await gotoGalleryAdmin(page);

    // `.last()`: MatSnackBar dismisses the previous snackbar (with an exit animation) when a
    // new one opens, so two `mat-snack-bar-container` elements can briefly coexist in the DOM
    // — the exiting one and the newly-opened one. The most recently attached is always last.
    const snackBar = page.locator('mat-snack-bar-container').last();

    const uploadCollectionButton = page.getByRole('button', { name: 'Upload Collection' });
    await expect(uploadCollectionButton).toBeEnabled();

    // 1. Attempt to upload a non-JSON file as a collection.
    const notJsonPath = writeTempFile('not-json.txt', 'this is not json at all\n');
    const notJsonResponse = await uploadFile(
      page,
      'Upload Collection',
      '/api/collections/json',
      notJsonPath
    );

    // expect: the upload is rejected with a 400 naming the real problem, not a generic 500.
    expect(notJsonResponse.ok()).toBe(false);
    expect(notJsonResponse.status()).toBe(400);
    expect((await notJsonResponse.json()).title).toBe(INVALID_JSON_MESSAGE);

    // expect: an error notification tells the user the upload failed, and the UI recovers
    // to an interactive state.
    await expect(snackBar).toContainText(INVALID_JSON_MESSAGE);
    await expect(uploadCollectionButton).toBeEnabled();

    // 2. Attempt to upload a malformed JSON file as a collection.
    // Structurally-broken JSON: an object that is opened and never closed.
    const malformedPath = writeTempFile('malformed.json', '{ "collection": { "name": "broken" ');
    const malformedResponse = await uploadFile(
      page,
      'Upload Collection',
      '/api/collections/json',
      malformedPath
    );

    // expect: rejected the same way — both a non-JSON file and truncated JSON raise
    // JsonException server-side, so both surface the same "not valid JSON" message.
    expect(malformedResponse.ok()).toBe(false);
    expect(malformedResponse.status()).toBe(400);
    expect((await malformedResponse.json()).title).toBe(INVALID_JSON_MESSAGE);

    await expect(snackBar).toContainText(INVALID_JSON_MESSAGE);
    await expect(uploadCollectionButton).toBeEnabled();

    // Neither attempt created anything. Deserialization fails before any DB write, so no
    // collection should carry the malformed fixture's name — nor the " - Admin User"
    // suffix `privateCollectionCopyAsync` would have appended on a successful import.
    const namesAfterCollectionUploads = await apiCollectionNames();
    expect(namesAfterCollectionUploads).not.toContain('broken');
    expect(namesAfterCollectionUploads).not.toContain('broken - Admin User');

    // 3. Attempt to upload a non-JSON file as an exhibit.
    // The exhibits table only renders once a collection is selected, and the upload
    // button lives in that table's header — so a collection must exist and be chosen.
    // Seed a dedicated one rather than relying on whatever is in the list.
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const hostCollection = await apiCreateCollection(
      `Invalid Upload Collection ${unique}`,
      'Collection hosting the invalid exhibit upload test'
    );
    createdCollectionIds.push(hostCollection.id);

    await gotoAdminSection(page, 'Exhibits');
    await page.getByRole('combobox', { name: 'Select a Collection' }).click();
    const hostOption = page.getByRole('option', { name: hostCollection.name, exact: true });
    await expect(hostOption).toBeVisible({ timeout: 20000 });
    await hostOption.click();

    await expect(page.getByRole('button', { name: 'Upload Exhibit' })).toBeEnabled();

    const exhibitNotJsonPath = writeTempFile('exhibit-not-json.txt', 'this is not json at all\n');
    const exhibitResponse = await uploadFile(
      page,
      'Upload Exhibit',
      '/api/exhibits/json',
      exhibitNotJsonPath
    );

    // expect: the same fix applies to the exhibit upload endpoint.
    expect(exhibitResponse.ok()).toBe(false);
    expect(exhibitResponse.status()).toBe(400);
    expect((await exhibitResponse.json()).title).toBe(INVALID_JSON_MESSAGE);

    // expect: notified and recovered here too.
    //
    // Note `selectFile()` calls `collectionDataService.setActive('')` before uploading,
    // which looks like it would collapse the table and take the upload button with it.
    // It does not: the `selectActiveId` subscription guards on `if (activeId && ...)`, so
    // the empty id is ignored and `selectedCollectionId` keeps its value. Verified live —
    // the button is still present and enabled after the failure.
    await expect(snackBar).toContainText(INVALID_JSON_MESSAGE);
    await expect(page.getByRole('button', { name: 'Upload Exhibit' })).toBeEnabled();

    // Nothing was imported: the host collection still has no exhibits.
    const exhibitsInHost = await galleryApi(async (ctx, token) => {
      const res = await ctx.get(
        `${Services.Gallery.API}/api/collections/${hostCollection.id}/exhibits`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      expect(res.ok()).toBe(true);
      return (await res.json()) as unknown[];
    });
    expect(exhibitsInHost).toHaveLength(0);
  });
});
