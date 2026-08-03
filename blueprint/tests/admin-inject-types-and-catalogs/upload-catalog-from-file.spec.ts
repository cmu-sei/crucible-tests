// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { getBlueprintToken, tempBlueprintName,
  acquireAdminCatalogLock,
  releaseAdminCatalogLock,
} from '../../test-helpers';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  // Serialize access to the shared admin Catalogs / Inject Types pages: they are not
  // safely concurrent (one unfiltered global inject store shared by an
  // app-inject-list mounted per row). See acquireAdminCatalogLock in test-helpers.
  test.beforeEach(async () => {
    await acquireAdminCatalogLock();
  });

  test.afterEach(async () => {
    await releaseAdminCatalogLock();
  });

  // Unique per run so concurrent runs / leftovers from an interrupted prior run never
  // collide, and the teardown purge auto-sweeps by the tempBlueprintName shape.
  let CATALOG_UPLOAD_BASE_NAME: string;
  // The API appends " - {username}" to the name on upload (see CatalogService.privateCatalogCopyAsync)
  let CATALOG_UPLOADED_NAME: string;
  let INJECT_TYPE_NAME: string;

  test.beforeEach(() => {
    CATALOG_UPLOAD_BASE_NAME = tempBlueprintName('UploadCat');
    CATALOG_UPLOADED_NAME = `${CATALOG_UPLOAD_BASE_NAME} - Admin`;
    INJECT_TYPE_NAME = tempBlueprintName('UploadCatIT');
  });

  // Cleanup runs in afterEach (not inline at the end of the test body) so a mid-test
  // failure still deletes what this test created. Catalogs are deleted before inject
  // types: deleting an inject type CASCADE-DELETES every catalog that still references it.
  test.afterEach(async () => {
    const token = await getBlueprintToken();
    const headers = { Authorization: `Bearer ${token}` };

    for (const [endpoint, name] of [
      ['/api/catalogs', CATALOG_UPLOADED_NAME],
      ['/api/injectTypes', INJECT_TYPE_NAME],
    ] as const) {
      const response = await fetch(`${Services.Blueprint.API}${endpoint}`, { headers });
      if (!response.ok) continue;

      for (const record of (await response.json()) as Array<{ id: string; name: string }>) {
        if (record.name === name) {
          await fetch(`${Services.Blueprint.API}${endpoint}/${record.id}`, {
            method: 'DELETE',
            headers,
          });
        }
      }
    }
  });

  test('Upload Catalog from File', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    // Helper: navigate to a section via the sidebar
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await expect(
        page.locator(`h1:has-text("${section}"), h2:has-text("${section}"), [class*="title"]:has-text("${section}"), mat-toolbar:has-text("${section}")`).first()
      ).toBeVisible({ timeout: 5000 });
    };

    // ── Step 1: Upload catalog from file ────────────────────────────────────

    await navigateTo('Catalogs');

    const uploadButton = page.getByRole('button', { name: 'Upload a new catalog from a file' });
    await expect(uploadButton).toBeVisible({ timeout: 5000 });

    // The upload button triggers a hidden <input type="file"> via jsonInput.click().
    // We must set up the fileChooser listener before clicking.
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
    await uploadButton.click();

    // expect: A file chooser opens
    const fileChooser = await fileChooserPromise;

    // 3. Build a valid catalog JSON in the format expected by the Blueprint API.
    // The API uses System.Text.Json with ReferenceHandler.Preserve, which requires
    // $id/$values format for collections. The catalog must include an InjectType
    // with a Name so the API can create (or match) an inject type. Random per-run IDs
    // (not fixed literals) so a leftover row from an interrupted prior run can never
    // collide with this run's upload.
    const catalogId = crypto.randomUUID();
    const injectTypeId = crypto.randomUUID();
    const catalogJson = JSON.stringify({
      '$id': '1',
      Id: catalogId,
      Name: CATALOG_UPLOAD_BASE_NAME,
      Description: 'Uploaded catalog for testing',
      InjectTypeId: injectTypeId,
      InjectType: {
        '$id': '2',
        Id: injectTypeId,
        Name: INJECT_TYPE_NAME,
        Description: 'Test inject type for upload',
        DataFields: {
          '$id': '3',
          '$values': []
        }
      },
      IsPublic: false,
      CatalogInjects: {
        '$id': '4',
        '$values': []
      },
      CatalogUnits: {
        '$id': '5',
        '$values': []
      }
    });

    const buffer = Buffer.from(catalogJson);

    // 4. Pair the upload with the response it triggers, then assert the uploaded row —
    // the API appends " - Admin" to the name (see CatalogService.privateCatalogCopyAsync).
    const uploadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /^\/api\/catalogs\/json$/.test(new URL(response.url()).pathname),
      { timeout: 15000 }
    );
    await fileChooser.setFiles([{
      name: 'test-catalog.json',
      mimeType: 'application/json',
      buffer: buffer,
    }]);
    expect((await uploadResponse).ok(), 'upload catalog response').toBeTruthy();

    // expect: The catalog is uploaded; the API appends " - Admin" to the name
    // (see CatalogService.privateCatalogCopyAsync line ~169)
    const uploadedCatalog = page.locator(`text=${CATALOG_UPLOADED_NAME}`).first();
    await expect(uploadedCatalog).toBeVisible({ timeout: 10000 });

    // Cleanup happens in afterEach (via the API) so a mid-test failure still cleans up.
  });
});
