// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';

const CATALOG_UPLOAD_BASE_NAME = 'Test Upload Catalog';
// The API appends " - {username}" to the name on upload (see CatalogService.privateCatalogCopyAsync)
const CATALOG_UPLOADED_NAME = `${CATALOG_UPLOAD_BASE_NAME} - Admin`;
const INJECT_TYPE_NAME = 'Test Upload Inject Type';

test.describe('Admin - Inject Types and Catalogs Management', () => {
  test('Upload Catalog from File', async ({ blueprintAuthenticatedPage: page }) => {
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await page.waitForLoadState('networkidle');

    // Helper: navigate to a section via the sidebar
    const navigateTo = async (section: string) => {
      const navItem = page.locator(`mat-list-item:has-text("${section}")`).first();
      await expect(navItem).toBeVisible({ timeout: 5000 });
      await navItem.click();
      await page.waitForLoadState('networkidle');
    };

    // Helper: delete all rows whose delete button title matches a pattern
    const deleteAllMatching = async (namePattern: RegExp) => {
      let deleteBtn = page.getByRole('button', { name: namePattern }).first();
      while (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        const confirmDialog = page.locator(
          '[role="dialog"], .mat-dialog-container, [class*="dialog"]'
        ).first();
        await expect(confirmDialog).toBeVisible({ timeout: 5000 });
        const confirmButton = page.locator(
          'button:has-text("Confirm"), button:has-text("Delete"), button:has-text("Yes"), button:has-text("OK")'
        ).last();
        await confirmButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        deleteBtn = page.getByRole('button', { name: namePattern }).first();
      }
    };

    // ── Step 0: Pre-cleanup ──────────────────────────────────────────────────

    // 1. Navigate to Catalogs and delete any leftover catalog from a prior run
    await navigateTo('Catalogs');
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_UPLOADED_NAME}`));

    // Also clean up the inject type we may have created during upload
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));

    // ── Step 1: Upload catalog from file ────────────────────────────────────

    // 2. Navigate to Catalogs section
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
    // with a Name so the API can create (or match) an inject type.
    const catalogId = '00000000-0000-0000-0000-000000000001';
    const injectTypeId = '00000000-0000-0000-0000-000000000002';
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
    await fileChooser.setFiles([{
      name: 'test-catalog.json',
      mimeType: 'application/json',
      buffer: buffer,
    }]);

    // 4. Wait for the upload API call to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // expect: The catalog is uploaded; the API appends " - Admin" to the name
    // (see CatalogService.privateCatalogCopyAsync line ~169)
    const uploadedCatalog = page.locator(`text=${CATALOG_UPLOADED_NAME}`).first();
    await expect(uploadedCatalog).toBeVisible({ timeout: 10000 });

    // ── Step 2: Cleanup ──────────────────────────────────────────────────────

    // 5. Delete the uploaded catalog
    await deleteAllMatching(new RegExp(`^Delete ${CATALOG_UPLOADED_NAME}`));

    // 6. Delete the inject type created during upload (if any)
    await navigateTo('Inject Types');
    await deleteAllMatching(new RegExp(`^Delete ${INJECT_TYPE_NAME}`));
  });
});
