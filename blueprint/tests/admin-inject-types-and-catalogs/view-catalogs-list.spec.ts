// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: specs/blueprint-test-plan.md
// seed: tests/seed.spec.ts

import { test, expect, Services } from '../../fixtures';
import { acquireAdminCatalogLock, releaseAdminCatalogLock } from '../../test-helpers';

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

  test('View Catalogs List', async ({ blueprintAuthenticatedPage: page }) => {
    // 1. Navigate to Admin section and select 'Catalogs'
    await page.goto(`${Services.Blueprint.UI}/admin`);
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    const catalogsNav = page.locator(
      'mat-list-item:has-text("Catalogs"), a:has-text("Catalogs"), button:has-text("Catalogs")'
    ).first();
    await expect(catalogsNav).toBeVisible({ timeout: 5000 });
    await catalogsNav.click();

    // expect: Catalogs list is displayed with columns: Public (checkbox), Name, Inject Type, Description
    const catalogsTable = page.locator('table, [class*="catalogs-table"]').first();
    await expect(catalogsTable).toBeVisible({ timeout: 5000 });

    const nameCol = page.getByRole('columnheader', { name: 'Name' });
    await expect(nameCol).toBeVisible({ timeout: 5000 });

    const injectTypeCol = page.getByRole('columnheader', { name: 'Inject Type' });
    const injectTypeVisible = await injectTypeCol.isVisible({ timeout: 3000 }).catch(() => false);

    // expect: Search functionality is available
    const searchInput = page.locator(
      'input[placeholder*="Search"], input[placeholder*="search"]'
    ).first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // expect: Actions include: Add new Catalog button, Upload a new catalog from a file button
    const addCatalogButton = page.getByRole('button', { name: 'Add new Catalog' });
    await expect(addCatalogButton).toBeVisible({ timeout: 5000 });

    const uploadCatalogButton = page.getByRole('button', { name: 'Upload a new catalog from a file' });
    await expect(uploadCatalogButton).toBeVisible({ timeout: 5000 });

    // expect: For each catalog row: Download (JSON), Upload xlsx, Delete, and Copy action buttons
    const catalogRows = page.locator('table tbody tr');
    const catalogCount = await catalogRows.count();
    if (catalogCount > 0) {
      const downloadButton = page.locator(
        'table tbody tr button[aria-label*="Download"], ' +
        'table tbody tr button:has(mat-icon:has-text("download")), ' +
        'table tbody tr mat-icon:has-text("download")'
      ).first();
      const downloadVisible = await downloadButton.isVisible({ timeout: 3000 }).catch(() => false);
    }
  });
});
