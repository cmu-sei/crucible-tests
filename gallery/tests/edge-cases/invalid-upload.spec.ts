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
 * IMPORTANT — what the app really does, and how this differs from the plan.
 *
 * The plan expects "an error message appears indicating invalid file format" /
 * "invalid JSON structure". **No error message is shown.** Invalid uploads fail
 * completely silently in the UI. Traced end to end:
 *
 *  - Both upload buttons ("Upload Collection" in admin Collections, "Upload Exhibit" in
 *    admin Exhibits) open a hidden `<input type="file" accept=".json">` and pass the
 *    file straight through `selectFile()` with no client-side validation.
 *  - Server side, `CollectionService.UploadJsonAsync` / `ExhibitService.UploadJsonAsync`
 *    call `JsonSerializer.Deserialize<...>` on the raw file text with no try/catch, so a
 *    non-JSON or truncated file raises `System.Text.Json.JsonException`. That is not an
 *    `IApiException`, so `ExceptionMiddleware.GetStatusCodeFromException` falls through
 *    to its `HttpStatusCode.InternalServerError` default — the API answers **500**, not
 *    a 400 validation response. Verified live against both endpoints:
 *      HTTP 500 {"title":"'this is not json at all\n' is an invalid JSON literal.
 *      Expected the literal 'true'. Path: $ | LineNumber: 0 | BytePositionInLine: 1.",
 *      "status":500,"detail":"System.Text.Json.JsonException: ..."}
 *      HTTP 500 {"title":"Expected depth to be zero at the end of the JSON payload.
 *      There is an open JSON object or array that should be closed. Path: $.collection
 *      | LineNumber: 0 | BytePositionInLine: 35.","status":500, ...}
 *  - Back in the client, `uploadJson` in `collection-data.service.ts` /
 *    `exhibit-data.service.ts` subscribes with its **own** error callback that does
 *    nothing but `setLoading(false)` and `uploadProgress.next(0)`. Because that callback
 *    handles the error, it never propagates to Angular's global `ErrorHandler`
 *    (`ErrorService`), which is the only thing in this app that opens the
 *    `app-system-message` bottom sheet. So no sheet, no snackbar, no dialog — the
 *    spinner simply stops and the list is unchanged. Confirmed empirically: a first
 *    version of this spec asserted an error sheet and failed because none appears.
 *
 * So rather than inventing a passing assertion, this spec pins the behaviour that is
 * genuinely observable and genuinely correct-ish: the API rejects the payload, **no
 * record is created**, and the UI recovers to an interactive state. It then asserts the
 * *absence* of any error notification, so that if the app is ever fixed to surface one
 * this test fails loudly and can be tightened to the plan's wording instead of silently
 * continuing to pass. See the "silent failure" assertions below.
 *
 * Fixture files are written under `os.tmpdir()` and removed in teardown so nothing is
 * scratched into the repo.
 */

const NOT_JSON_MESSAGE = /is an invalid JSON literal/;
const TRUNCATED_JSON_MESSAGE = /Expected depth to be zero at the end of the JSON payload/;

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

    // Any error notification this app could raise renders as one of these. Asserting
    // they stay absent is the honest encoding of the silent-failure behaviour.
    const errorSheet = page.locator('app-system-message');
    const anyDialog = page.getByRole('dialog');

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

    // expect: the upload is rejected. The API refuses to import the file — 500 rather
    // than a 400, because the JsonException is unmapped (see the header comment).
    expect(notJsonResponse.ok()).toBe(false);
    expect(notJsonResponse.status()).toBe(500);
    expect((await notJsonResponse.json()).title).toMatch(NOT_JSON_MESSAGE);

    // expect (real behaviour, NOT the plan's): nothing tells the user. The UI just
    // returns to an interactive state — the re-enabled button is the store's
    // setLoading(false) landing in the DOM, which also proves the client observed the
    // failure rather than hanging.
    await expect(uploadCollectionButton).toBeEnabled();
    await expect(errorSheet).toHaveCount(0);
    await expect(anyDialog).toHaveCount(0);

    // 2. Attempt to upload a malformed JSON file as a collection.
    // Structurally-broken JSON: an object that is opened and never closed.
    const malformedPath = writeTempFile('malformed.json', '{ "collection": { "name": "broken" ');
    const malformedResponse = await uploadFile(
      page,
      'Upload Collection',
      '/api/collections/json',
      malformedPath
    );

    // expect: the malformed structure is rejected, with a message naming the structural
    // problem (an unclosed object) rather than a generic failure.
    expect(malformedResponse.ok()).toBe(false);
    expect(malformedResponse.status()).toBe(500);
    expect((await malformedResponse.json()).title).toMatch(TRUNCATED_JSON_MESSAGE);

    // Again silent, and again recovered.
    await expect(uploadCollectionButton).toBeEnabled();
    await expect(errorSheet).toHaveCount(0);
    await expect(anyDialog).toHaveCount(0);

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

    // expect: the upload is rejected with the same unhandled-JsonException 500.
    expect(exhibitResponse.ok()).toBe(false);
    expect(exhibitResponse.status()).toBe(500);
    expect((await exhibitResponse.json()).title).toMatch(NOT_JSON_MESSAGE);

    // expect (real behaviour): silent here too, and the pane recovers to interactive.
    //
    // Note `selectFile()` calls `collectionDataService.setActive('')` before uploading,
    // which looks like it would collapse the table and take the upload button with it.
    // It does not: the `selectActiveId` subscription guards on `if (activeId && ...)`, so
    // the empty id is ignored and `selectedCollectionId` keeps its value. Verified live —
    // the button is still present and enabled after the failure.
    await expect(page.getByRole('button', { name: 'Upload Exhibit' })).toBeEnabled();
    await expect(errorSheet).toHaveCount(0);
    await expect(anyDialog).toHaveCount(0);

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
